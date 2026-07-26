import { describe, it, expect } from 'vitest';
import { computeWaveSkeleton, WaveReason } from './waveSkeleton';
import { GraphEdge, GraphEpic, GraphNode, ParsedGraph } from './types';

function feature(id: string, epic?: string): GraphNode {
  return { id, type: 'feature', path: `assets/feature/${id}.md`, ...(epic ? { epic } : {}) };
}

function epic(id: string): GraphEpic {
  return { id, name: id, path: `assets/epic/${id}.md` };
}

function edge(from: string, type: GraphEdge['type'], to: string): GraphEdge {
  return { from, type, to };
}

function reasonKinds(reasons: WaveReason[]): string[] {
  return reasons.map((r) => r.kind);
}

describe('computeWaveSkeleton — waves.md §4 worked example', () => {
  const graph: ParsedGraph = {
    epics: [epic('epic:ai-pipeline'), epic('epic:daily-metrics')],
    nodes: [
      feature('feature:sign-in'),
      feature('feature:sign-up'),
      feature('feature:onboarding-conversation'),
      feature('feature:daily-metrics-computation', 'epic:daily-metrics'),
      feature('feature:insights-orchestrator', 'epic:ai-pipeline'),
      feature('feature:pattern-detective', 'epic:ai-pipeline'),
      feature('feature:note-capture'),
      feature('feature:voice-capture-pipeline'),
      feature('feature:note-enrichment'),
    ],
    edges: [
      edge('feature:onboarding-conversation', 'depends_on', 'feature:sign-up'),
      edge('feature:insights-orchestrator', 'depends_on', 'feature:daily-metrics-computation'),
      edge('feature:note-capture', 'depends_on', 'feature:voice-capture-pipeline'),
      edge('feature:voice-capture-pipeline', 'depends_on', 'feature:note-enrichment'),
      edge('feature:note-enrichment', 'depends_on', 'feature:note-capture'),
    ],
  };

  const result = computeWaveSkeleton(graph);
  const byId = new Map(result.waves.map((w) => [w.featureId, w]));

  it('unconstrained features land in wave 1', () => {
    expect(byId.get('feature:sign-in')?.wave).toBe(1);
    expect(byId.get('feature:sign-up')?.wave).toBe(1);
    expect(byId.get('feature:daily-metrics-computation')?.wave).toBe(1);
    expect(reasonKinds(byId.get('feature:sign-in')!.reasons)).toEqual(['no-constraint']);
  });

  it('a direct depends_on edge lands the dependent one wave later, citing the predecessor', () => {
    const w = byId.get('feature:onboarding-conversation')!;
    expect(w.wave).toBe(2);
    expect(w.reasons).toEqual([
      { kind: 'direct-edge', predecessorId: 'feature:sign-up', edge: edge('feature:onboarding-conversation', 'depends_on', 'feature:sign-up') },
    ]);
  });

  it('the feature that itself caused a cross-epic edge is cited by its own direct edge, not double-counted via the epic floor', () => {
    const w = byId.get('feature:insights-orchestrator')!;
    expect(w.wave).toBe(2);
    expect(reasonKinds(w.reasons)).toEqual(['direct-edge']);
  });

  it("a sibling with no edge of its own inherits its epic's floor, citing the specific edge that established it — same single-hop wave as a direct edge would cost", () => {
    const w = byId.get('feature:pattern-detective')!;
    expect(w.wave).toBe(2);
    expect(w.reasons).toEqual([
      {
        kind: 'epic-floor',
        predecessorId: 'feature:daily-metrics-computation',
        edge: edge('feature:insights-orchestrator', 'depends_on', 'feature:daily-metrics-computation'),
        fromEpic: 'epic:daily-metrics',
        toEpic: 'epic:ai-pipeline',
      },
    ]);
  });

  it('a genuine mutual dependency collapses into one cycle group sharing one wave', () => {
    const a = byId.get('feature:note-capture')!;
    const b = byId.get('feature:voice-capture-pipeline')!;
    const c = byId.get('feature:note-enrichment')!;
    expect(a.wave).toBe(b.wave);
    expect(b.wave).toBe(c.wave);
    expect(a.reasons).toEqual([
      { kind: 'cycle-group', members: ['feature:note-enrichment', 'feature:voice-capture-pipeline'] },
    ]);
  });
});

describe('computeWaveSkeleton — tie-breaking when multiple predecessors are equally binding', () => {
  it('cites every predecessor that actually produced the final wave, not just one', () => {
    const graph: ParsedGraph = {
      epics: [],
      nodes: [feature('feature:tie-a'), feature('feature:tie-b'), feature('feature:tie-consumer')],
      edges: [
        edge('feature:tie-consumer', 'depends_on', 'feature:tie-a'),
        edge('feature:tie-consumer', 'depends_on', 'feature:tie-b'),
      ],
    };
    const result = computeWaveSkeleton(graph);
    const consumer = result.waves.find((w) => w.featureId === 'feature:tie-consumer')!;
    expect(consumer.wave).toBe(2);
    expect(reasonKinds(consumer.reasons)).toEqual(['direct-edge', 'direct-edge']);
    const predecessorIds = consumer.reasons.map((r) => (r as { predecessorId: string }).predecessorId).sort();
    expect(predecessorIds).toEqual(['feature:tie-a', 'feature:tie-b']);
  });
});

describe('computeWaveSkeleton — dispatches direction is the opposite of depends_on', () => {
  it('from comes before to for a dispatches edge', () => {
    const graph: ParsedGraph = {
      epics: [],
      nodes: [feature('feature:trigger'), feature('feature:handler')],
      edges: [edge('feature:trigger', 'dispatches', 'feature:handler')],
    };
    const result = computeWaveSkeleton(graph);
    const byId = new Map(result.waves.map((w) => [w.featureId, w]));
    expect(byId.get('feature:trigger')?.wave).toBe(1);
    expect(byId.get('feature:handler')?.wave).toBe(2);
    expect(byId.get('feature:handler')?.reasons).toEqual([
      { kind: 'direct-edge', predecessorId: 'feature:trigger', edge: edge('feature:trigger', 'dispatches', 'feature:handler') },
    ]);
  });
});

describe('computeWaveSkeleton — epic-floor-induced cycle with no direct feature-level cycle', () => {
  // x1 depends_on y1 -> epic X requires epic Y (via this specific pair).
  // y2 depends_on x2 -> epic Y requires epic X (via this other specific pair).
  // Neither pair shares a feature with the other, so there's no cycle among
  // the real feature-level edges alone — the cycle only appears once the
  // epic-floor synthetic edges (x1's fact reaching x2, y2's fact reaching y1)
  // are added, which is exactly the case step (b)'s per-feature SCC pass
  // can't see on its own.
  const cyclicGraph: ParsedGraph = {
    epics: [epic('epic:x'), epic('epic:y')],
    nodes: [
      feature('feature:x1', 'epic:x'),
      feature('feature:x2', 'epic:x'),
      feature('feature:y1', 'epic:y'),
      feature('feature:y2', 'epic:y'),
    ],
    edges: [edge('feature:x1', 'depends_on', 'feature:y1'), edge('feature:y2', 'depends_on', 'feature:x2')],
  };

  it('does not throw — returns a partial result instead, so Step 2 has something to act on', () => {
    expect(() => computeWaveSkeleton(cyclicGraph)).not.toThrow();
  });

  it('isolates the true cyclic core (x2, y1) with wave: null and the contributing edges, not lumped in with bystanders', () => {
    const result = computeWaveSkeleton(cyclicGraph);
    const byId = new Map(result.waves.map((w) => [w.featureId, w]));

    for (const id of ['feature:x2', 'feature:y1']) {
      const w = byId.get(id)!;
      expect(w.wave).toBeNull();
      expect(reasonKinds(w.reasons)).toEqual(['unresolved-epic-floor-cycle']);
      const reason = w.reasons[0] as { cycleMembers: string[]; contributingEdges: string[] };
      expect(reason.cycleMembers.sort()).toEqual([id === 'feature:x2' ? 'feature:y1' : 'feature:x2']);
      expect(reason.contributingEdges).toEqual(
        expect.arrayContaining([
          expect.stringContaining('feature:x1 depends_on feature:y1'),
          expect.stringContaining('feature:y2 depends_on feature:x2'),
        ])
      );
    }
  });

  it('marks features merely downstream of the cycle (x1, y2) as blocked, not cyclic themselves', () => {
    const result = computeWaveSkeleton(cyclicGraph);
    const byId = new Map(result.waves.map((w) => [w.featureId, w]));

    for (const id of ['feature:x1', 'feature:y2']) {
      const w = byId.get(id)!;
      expect(w.wave).toBeNull();
      expect(reasonKinds(w.reasons)).toEqual(['blocked-by-unresolved-cycle']);
      const reason = w.reasons[0] as { cycleMembers: string[] };
      expect(reason.cycleMembers.sort()).toEqual(['feature:x2', 'feature:y1']);
    }
  });

  it('leaves every unrelated feature elsewhere in the graph completely unaffected', () => {
    const graphWithUnrelatedFeature: ParsedGraph = {
      ...cyclicGraph,
      nodes: [...cyclicGraph.nodes, feature('feature:unrelated')],
    };
    const result = computeWaveSkeleton(graphWithUnrelatedFeature);
    const unrelated = result.waves.find((w) => w.featureId === 'feature:unrelated')!;
    expect(unrelated.wave).toBe(1);
    expect(reasonKinds(unrelated.reasons)).toEqual(['no-constraint']);
  });

  it('a feature that is both a genuine mutual-dependency group AND caught in an epic-floor cycle reports both facts', () => {
    // x2 gets a real, direct mutual dependency with a third feature x3 (also
    // in epic:x) — a genuine cycle-group, collapsed in step (b), same as the
    // sign-in-style test above. That group is *separately* still caught in
    // the same epic-floor cycle as before (epic:x needs epic:y via x1/y1,
    // epic:y needs epic:x via y2/x2) — the two facts are independent of each
    // other, so the feature should report both, not just one overwriting
    // the other. (Merging x2 directly with y1 instead, tried first, turned
    // out to eliminate the epic-floor cycle entirely — see the self-loop
    // fix in computeWaveSkeleton — so this uses a third feature instead.)
    const compoundGraph: ParsedGraph = {
      epics: [epic('epic:x'), epic('epic:y')],
      nodes: [...cyclicGraph.nodes, feature('feature:x3', 'epic:x')],
      edges: [
        ...cyclicGraph.edges,
        edge('feature:x2', 'depends_on', 'feature:x3'),
        edge('feature:x3', 'depends_on', 'feature:x2'),
      ],
    };
    const result = computeWaveSkeleton(compoundGraph);
    const x2 = result.waves.find((w) => w.featureId === 'feature:x2')!;
    expect(x2.wave).toBeNull();
    expect(reasonKinds(x2.reasons)).toEqual(expect.arrayContaining(['cycle-group', 'unresolved-epic-floor-cycle']));
    const cycleGroupReason = x2.reasons.find((r) => r.kind === 'cycle-group') as { members: string[] };
    expect(cycleGroupReason.members).toEqual(['feature:x3']);
  });
});
