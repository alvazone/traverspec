import { describe, it, expect } from 'vitest';
import { computePlan } from './plan';
import { ParsedGraph, GraphNode, GraphEdge } from './types';

function feature(id: string): GraphNode {
  return { id, type: 'feature', path: `assets/feature/${id}.md` };
}

function graphOf(featureIds: string[], edges: GraphEdge[]): ParsedGraph {
  return { epics: [], nodes: featureIds.map((id) => feature(`feature:${id}`)), edges };
}

function edge(from: string, type: GraphEdge['type'], to: string): GraphEdge {
  return { from: `feature:${from}`, type, to: `feature:${to}` };
}

describe('computePlan', () => {
  it('reproduces the real 6-hop depends_on chain traced by hand earlier (create-event → ... → sign-up)', () => {
    const graph = graphOf(
      ['sign-up', 'onboarding-conversation', 'onboarding-session-1', 'onboarding-session-2', 'start-day', 'create-event'],
      [
        edge('onboarding-conversation', 'depends_on', 'sign-up'),
        edge('onboarding-session-1', 'depends_on', 'onboarding-conversation'),
        edge('onboarding-session-2', 'depends_on', 'onboarding-session-1'),
        edge('start-day', 'depends_on', 'onboarding-session-2'),
        edge('create-event', 'depends_on', 'start-day'),
      ]
    );

    const result = computePlan(graph);
    expect(result.waves).toHaveLength(6);
    const order = result.waves.map((w) => w.groups[0].members[0]);
    expect(order).toEqual([
      'feature:sign-up',
      'feature:onboarding-conversation',
      'feature:onboarding-session-1',
      'feature:onboarding-session-2',
      'feature:start-day',
      'feature:create-event',
    ]);
    expect(result.waves.every((w) => w.groups.every((g) => g.reason === 'single'))).toBe(true);
  });

  it('places independent features with no dependencies in the same wave', () => {
    const graph = graphOf(['sign-up', 'manage-holidays'], []);
    const result = computePlan(graph);
    expect(result.waves).toHaveLength(1);
    expect(result.waves[0].groups.map((g) => g.members[0]).sort()).toEqual([
      'feature:manage-holidays',
      'feature:sign-up',
    ]);
  });

  it('groups a real depends_on cycle together and labels it "cycle"', () => {
    const graph = graphOf(
      ['checkout', 'apply-discount'],
      [edge('checkout', 'depends_on', 'apply-discount'), edge('apply-discount', 'depends_on', 'checkout')]
    );
    const result = computePlan(graph);
    expect(result.waves).toHaveLength(1);
    const group = result.waves[0].groups[0];
    expect(group.members.sort()).toEqual(['feature:apply-discount', 'feature:checkout']);
    expect(group.reason).toBe('cycle');
  });

  it('groups a dispatches pair together and labels it "dispatch"', () => {
    const graph = graphOf(
      ['day-auto-close', 'daily-metrics-computation'],
      [edge('day-auto-close', 'dispatches', 'daily-metrics-computation')]
    );
    const result = computePlan(graph);
    expect(result.waves).toHaveLength(1);
    const group = result.waves[0].groups[0];
    expect(group.members.sort()).toEqual(['feature:daily-metrics-computation', 'feature:day-auto-close']);
    expect(group.reason).toBe('dispatch');
  });

  it('groups the cascading case: a depends_on chain plus one dispatches edge forming a cycle that neither edge type creates alone', () => {
    // A depends_on B, B depends_on C, A dispatches C.
    // Combined graph: A->B, B->C, A->C, C->A. A can reach C via B, and C reaches A directly —
    // all three become mutually reachable, forming one SCC, even though the
    // depends_on-only subgraph (A->B->C) has no cycle by itself.
    const graph = graphOf(
      ['a', 'b', 'c'],
      [edge('a', 'depends_on', 'b'), edge('b', 'depends_on', 'c'), edge('a', 'dispatches', 'c')]
    );
    const result = computePlan(graph);
    expect(result.waves).toHaveLength(1);
    const group = result.waves[0].groups[0];
    expect(group.members.sort()).toEqual(['feature:a', 'feature:b', 'feature:c']);
    expect(group.reason).toBe('dispatch'); // no depends_on-only cycle exists among just these three
  });

  it('orders a group correctly relative to nodes outside it', () => {
    // X depends_on the {checkout, apply-discount} cycle.
    const graph = graphOf(
      ['checkout', 'apply-discount', 'receipt-email'],
      [
        edge('checkout', 'depends_on', 'apply-discount'),
        edge('apply-discount', 'depends_on', 'checkout'),
        edge('receipt-email', 'depends_on', 'checkout'),
      ]
    );
    const result = computePlan(graph);
    expect(result.waves).toHaveLength(2);
    expect(result.waves[0].groups[0].members.sort()).toEqual(['feature:apply-discount', 'feature:checkout']);
    expect(result.waves[1].groups[0].members).toEqual(['feature:receipt-email']);
  });

  it('ignores edges to/from non-feature nodes', () => {
    const graph: ParsedGraph = {
      epics: [],
      nodes: [feature('feature:sign-up'), { id: 'data_model:User', type: 'data_model', path: 'x' }],
      edges: [{ from: 'feature:sign-up', type: 'mutates', to: 'data_model:User' }],
    };
    const result = computePlan(graph);
    expect(result.waves).toHaveLength(1);
    expect(result.waves[0].groups[0].members).toEqual(['feature:sign-up']);
  });
});
