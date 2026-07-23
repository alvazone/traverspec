import { describe, it, expect } from 'vitest';
import { resolveShowIds, computeShow, ShowResult } from './traverse';
import { ParsedGraph } from './types';

function graph(overrides: Partial<ParsedGraph>): ParsedGraph {
  return { epics: [], nodes: [], edges: [], ...overrides };
}

function allEdges(result: ShowResult) {
  return result.levels.flatMap((l) => l.edges);
}

function levelOf(result: ShowResult, from: string, type: string, to: string): number | undefined {
  return result.levels.find((l) => l.edges.some((e) => e.from === from && e.type === type && e.to === to))?.level;
}

describe('resolveShowIds', () => {
  const g = graph({
    epics: [{ id: 'epic:billing', name: 'Billing', path: 'x' }],
    nodes: [{ id: 'feature:checkout', type: 'feature', path: 'x' }],
  });

  it('passes an id that exists as a node', () => {
    expect(resolveShowIds(['feature:checkout'], g).errors).toEqual([]);
  });

  it('flags an id that does not exist at all', () => {
    const { errors } = resolveShowIds(['feature:ghost'], g);
    expect(errors).toEqual(["'feature:ghost' does not exist in graph.yaml"]);
  });

  it('flags an epic id with a specific message, not a generic not-found', () => {
    const { errors } = resolveShowIds(['epic:billing'], g);
    expect(errors[0]).toContain('is an epic, a filtering label, not a traversable node');
  });

  it('reports every problem in a multi-id call, not just the first', () => {
    const { errors } = resolveShowIds(['epic:billing', 'feature:ghost'], g);
    expect(errors.length).toBe(2);
  });
});

describe('computeShow — forward and reverse closure', () => {
  // A -> B -> C (depends_on chain); C -> X (mutates); Y -> X (foreign_key)
  // D <-> A (dispatches, a cycle); isolated has no edges at all.
  const g = graph({
    nodes: [
      { id: 'feature:A', type: 'feature', path: 'x' },
      { id: 'feature:B', type: 'feature', path: 'x' },
      { id: 'feature:C', type: 'feature', path: 'x' },
      { id: 'feature:D', type: 'feature', path: 'x' },
      { id: 'data_model:X', type: 'data_model', path: 'x' },
      { id: 'data_model:Y', type: 'data_model', path: 'x' },
      { id: 'feature:isolated', type: 'feature', path: 'x' },
    ],
    edges: [
      { from: 'feature:A', type: 'depends_on', to: 'feature:B' },
      { from: 'feature:B', type: 'depends_on', to: 'feature:C' },
      { from: 'feature:C', type: 'mutates', to: 'data_model:X' },
      { from: 'data_model:Y', type: 'foreign_key', to: 'data_model:X' },
      { from: 'feature:D', type: 'dispatches', to: 'feature:A' },
      { from: 'feature:A', type: 'dispatches', to: 'feature:D' },
    ],
  });

  it('walks the full transitive forward chain, not just one hop', () => {
    const result = computeShow(['feature:A'], g);
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('feature:B')).toBe(true);
    expect(ids.has('feature:C')).toBe(true);
    expect(ids.has('data_model:X')).toBe(true); // transitively via C
  });

  it('walks the reverse closure to find what points at a node, transitively', () => {
    const result = computeShow(['data_model:X'], g);
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('feature:C')).toBe(true); // direct
    expect(ids.has('feature:B')).toBe(true); // transitively, B depends on C which mutates X
    expect(ids.has('feature:A')).toBe(true);
    expect(ids.has('data_model:Y')).toBe(true); // reverse via foreign_key
  });

  it('does not pull in unrelated nodes that merely share a neighbor (no flood-fill across directions)', () => {
    // Y is a reverse-neighbor of X; C is a forward-source of X. Y and C
    // aren't otherwise connected, but a naive combined walk would still
    // link them through X. Only C is legitimately in A's forward closure.
    const result = computeShow(['feature:A'], g);
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('data_model:Y')).toBe(false);
  });

  it('handles a cycle without infinite-looping and dedupes the edge', () => {
    const result = computeShow(['feature:A'], g);
    const dispatchEdges = allEdges(result).filter((e) => e.type === 'dispatches');
    expect(dispatchEdges.length).toBe(2); // A->D and D->A, each once
  });

  it('excludes a fully disconnected node from the closure but still counts it in totalNodes', () => {
    const result = computeShow(['feature:A'], g);
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('feature:isolated')).toBe(false);
    expect(result.totalNodes).toBe(g.nodes.length);
  });

  it('unions and dedupes closures across multiple starting ids', () => {
    const single = allEdges(computeShow(['data_model:X'], g)).length;
    const combined = computeShow(['feature:A', 'data_model:X'], g);
    const combinedEdges = allEdges(combined);
    // combined includes everything from A's closure plus X's, with the
    // A->B->C->X chain shared between them counted once, not twice.
    expect(combinedEdges.length).toBeGreaterThanOrEqual(single);
    const seen = new Set(combinedEdges.map((e) => `${e.from}|${e.type}|${e.to}`));
    expect(seen.size).toBe(combinedEdges.length);
  });

  it('reports coverage as covered/total node counts', () => {
    const result = computeShow(['feature:isolated'], g);
    expect(result.coveredNodes).toBe(1); // only itself, no edges
    expect(result.totalNodes).toBe(g.nodes.length);
  });
});

describe('computeShow — levels', () => {
  // X -> Y -> Z -> W, a straight four-node chain.
  const chain = graph({
    nodes: [
      { id: 'feature:X', type: 'feature', path: 'x' },
      { id: 'feature:Y', type: 'feature', path: 'x' },
      { id: 'feature:Z', type: 'feature', path: 'x' },
      { id: 'feature:W', type: 'feature', path: 'x' },
    ],
    edges: [
      { from: 'feature:X', type: 'depends_on', to: 'feature:Y' },
      { from: 'feature:Y', type: 'depends_on', to: 'feature:Z' },
      { from: 'feature:Z', type: 'depends_on', to: 'feature:W' },
    ],
  });

  it('assigns level 1 to edges directly touching the start node', () => {
    const result = computeShow(['feature:X'], chain, 'forward');
    expect(levelOf(result, 'feature:X', 'depends_on', 'feature:Y')).toBe(1);
  });

  it('assigns increasing levels as the chain gets further from the start', () => {
    const result = computeShow(['feature:X'], chain, 'forward');
    expect(levelOf(result, 'feature:Y', 'depends_on', 'feature:Z')).toBe(2);
    expect(levelOf(result, 'feature:Z', 'depends_on', 'feature:W')).toBe(3);
  });

  it('levels come back sorted ascending, one entry per level', () => {
    const result = computeShow(['feature:X'], chain, 'forward');
    expect(result.levels.map((l) => l.level)).toEqual([1, 2, 3]);
  });

  it('in both mode, a node gets the shortest distance reached from either direction', () => {
    // C -> A -> B: reverse from A reaches C at level 1; forward from A
    // reaches B at level 1. Both should land at level 1, not be conflated
    // with some other distance from a separate merge step.
    const g = graph({
      nodes: [
        { id: 'feature:A', type: 'feature', path: 'x' },
        { id: 'feature:B', type: 'feature', path: 'x' },
        { id: 'feature:C', type: 'feature', path: 'x' },
      ],
      edges: [
        { from: 'feature:A', type: 'depends_on', to: 'feature:B' },
        { from: 'feature:C', type: 'depends_on', to: 'feature:A' },
      ],
    });
    const result = computeShow(['feature:A'], g, 'both');
    expect(levelOf(result, 'feature:A', 'depends_on', 'feature:B')).toBe(1);
    expect(levelOf(result, 'feature:C', 'depends_on', 'feature:A')).toBe(1);
  });

  it('lists the newly-discovered node ids at each level, not just edges', () => {
    const result = computeShow(['feature:X'], chain, 'forward');
    expect(result.levels.find((l) => l.level === 1)?.nodes).toEqual(['feature:Y']);
    expect(result.levels.find((l) => l.level === 2)?.nodes).toEqual(['feature:Z']);
    expect(result.levels.find((l) => l.level === 3)?.nodes).toEqual(['feature:W']);
  });

  it('does not list the start id itself as a discovered node at any level', () => {
    const result = computeShow(['feature:X'], chain, 'forward');
    const allNodes = result.levels.flatMap((l) => l.nodes);
    expect(allNodes).not.toContain('feature:X');
  });

  it('a cross edge between two nodes already known at the same level stays at that level, not one deeper', () => {
    // This is the exact bug found on real data: User has two direct
    // dependents, RefreshToken and Calendar, and RefreshToken also has a
    // foreign_key edge to Calendar. That edge should land at level 1
    // (same as both endpoints), not level 2, even though it's naturally
    // encountered while processing a level-1 node.
    const g = graph({
      nodes: [
        { id: 'data_model:User', type: 'data_model', path: 'x' },
        { id: 'data_model:RefreshToken', type: 'data_model', path: 'x' },
        { id: 'data_model:Calendar', type: 'data_model', path: 'x' },
      ],
      edges: [
        { from: 'data_model:RefreshToken', type: 'foreign_key', to: 'data_model:User' },
        { from: 'data_model:Calendar', type: 'foreign_key', to: 'data_model:User' },
        { from: 'data_model:RefreshToken', type: 'foreign_key', to: 'data_model:Calendar' },
      ],
    });
    const result = computeShow(['data_model:User'], g, 'reverse');
    expect(levelOf(result, 'data_model:RefreshToken', 'foreign_key', 'data_model:User')).toBe(1);
    expect(levelOf(result, 'data_model:Calendar', 'foreign_key', 'data_model:User')).toBe(1);
    expect(levelOf(result, 'data_model:RefreshToken', 'foreign_key', 'data_model:Calendar')).toBe(1);
  });
});

describe('computeShow — direction parameter', () => {
  // A -> B (depends_on), C -> A (depends_on). Forward from A reaches B;
  // reverse from A reaches C. Direction should isolate these, not merge.
  const g = graph({
    nodes: [
      { id: 'feature:A', type: 'feature', path: 'x' },
      { id: 'feature:B', type: 'feature', path: 'x' },
      { id: 'feature:C', type: 'feature', path: 'x' },
    ],
    edges: [
      { from: 'feature:A', type: 'depends_on', to: 'feature:B' },
      { from: 'feature:C', type: 'depends_on', to: 'feature:A' },
    ],
  });

  it('defaults to both directions when not specified', () => {
    const result = computeShow(['feature:A'], g);
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('feature:B')).toBe(true);
    expect(ids.has('feature:C')).toBe(true);
  });

  it('direction=forward excludes reverse-only nodes', () => {
    const result = computeShow(['feature:A'], g, 'forward');
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('feature:B')).toBe(true);
    expect(ids.has('feature:C')).toBe(false);
  });

  it('direction=reverse excludes forward-only nodes', () => {
    const result = computeShow(['feature:A'], g, 'reverse');
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('feature:C')).toBe(true);
    expect(ids.has('feature:B')).toBe(false);
  });

  it('direction=forward still stays fully transitive, not one-hop', () => {
    const chain = graph({
      nodes: [
        { id: 'feature:X', type: 'feature', path: 'x' },
        { id: 'feature:Y', type: 'feature', path: 'x' },
        { id: 'feature:Z', type: 'feature', path: 'x' },
      ],
      edges: [
        { from: 'feature:X', type: 'depends_on', to: 'feature:Y' },
        { from: 'feature:Y', type: 'depends_on', to: 'feature:Z' },
      ],
    });
    const result = computeShow(['feature:X'], chain, 'forward');
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('feature:Z')).toBe(true); // two hops away, still included
  });
});

describe('computeShow — overrides applies regardless of direction', () => {
  const g = graph({
    nodes: [
      { id: 'feature:checkout', type: 'feature', path: 'x' },
      { id: 'business_rule:BR-0001', type: 'business_rule', path: 'x' },
      { id: 'decision:DC-0001', type: 'decision', path: 'x' },
    ],
    edges: [
      { from: 'feature:checkout', type: 'enforces', to: 'business_rule:BR-0001' },
      { from: 'decision:DC-0001', type: 'overrides', to: 'business_rule:BR-0001' },
    ],
  });

  it('still pulls in the overriding decision even when direction=forward', () => {
    const result = computeShow(['feature:checkout'], g, 'forward');
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('decision:DC-0001')).toBe(true);
  });
});

describe('computeShow — overrides special case', () => {
  const g = graph({
    nodes: [
      { id: 'feature:checkout', type: 'feature', path: 'x' },
      { id: 'business_rule:BR-0001', type: 'business_rule', path: 'x' },
      { id: 'decision:DC-0001', type: 'decision', path: 'x' },
    ],
    edges: [
      { from: 'feature:checkout', type: 'enforces', to: 'business_rule:BR-0001' },
      { from: 'decision:DC-0001', type: 'overrides', to: 'business_rule:BR-0001' },
    ],
  });

  it('pulls in the decision that overrides a business_rule reached via a normal edge', () => {
    const result = computeShow(['feature:checkout'], g);
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('decision:DC-0001')).toBe(true);
    expect(allEdges(result).some((e) => e.type === 'overrides')).toBe(true);
  });

  it('pulls in the business_rule a decision overrides, when the decision is the start node', () => {
    const result = computeShow(['decision:DC-0001'], g);
    const ids = new Set(allEdges(result).flatMap((e) => [e.from, e.to]));
    expect(ids.has('business_rule:BR-0001')).toBe(true);
  });

  it('attaches the overrides edge to the same level as the node that triggered it, not one level further out', () => {
    // BR-0001 is reached at level 1 (checkout enforces it directly). The
    // overrides edge onto it should also land at level 1, not level 2.
    const result = computeShow(['feature:checkout'], g);
    expect(levelOf(result, 'feature:checkout', 'enforces', 'business_rule:BR-0001')).toBe(1);
    expect(levelOf(result, 'decision:DC-0001', 'overrides', 'business_rule:BR-0001')).toBe(1);
  });
});
