import { GraphEdge, ParsedGraph } from './types';

/**
 * Computes waves.md's Step 1 — the mechanical wave skeleton — as a real,
 * tested algorithm rather than agent-hand-simulated prose. Step 2 (the
 * prose-verification pass over specs) stays agent judgment; this only
 * covers what can be derived from graph.yaml's edges and epic labels.
 *
 * An epic-floor cycle (two epics whose features cross-depend on each
 * other, even though no individual feature-level dependency cycles) is
 * NOT treated as fatal. It's a real, checkable ambiguity the epic-floor
 * heuristic itself can manufacture — the underlying depends_on/dispatches
 * edges are often perfectly consistent on their own, it's generalizing a
 * single feature pair's fact into an epic-wide requirement that can
 * conflict with another such generalization. Only reading the actual
 * specs (Step 2) can say whether either generalization was ever real, so
 * the affected features come back with wave: null and a reason instead of
 * aborting the whole computation — everything else in the graph still
 * gets its normal wave, unaffected.
 */
export type WaveReason =
  | { kind: 'no-constraint' }
  | { kind: 'direct-edge'; predecessorId: string; edge: GraphEdge }
  | { kind: 'epic-floor'; predecessorId: string; edge: GraphEdge; fromEpic: string; toEpic: string }
  | { kind: 'cycle-group'; members: string[] }
  | { kind: 'unresolved-epic-floor-cycle'; cycleMembers: string[]; contributingEdges: string[] }
  | { kind: 'blocked-by-unresolved-cycle'; cycleMembers: string[] };

export interface FeatureWave {
  featureId: string;
  wave: number | null;
  reasons: WaveReason[];
}

export interface WaveSkeletonResult {
  waves: FeatureWave[];
  maxWave: number;
}

interface NormEdge {
  before: string;
  after: string;
  edge: GraphEdge;
}

/**
 * Normalizes depends_on/dispatches edges between two feature nodes into a
 * single "before happens before after" direction. depends_on(from,to) means
 * from comes after to (to is the static prerequisite); dispatches(from,to)
 * means from comes before to (finishing the dispatcher is what triggers the
 * target). This asymmetry is intentional — an earlier attempt treated both
 * edge types the same way and shipped a build order that was backwards.
 */
function normalizeOrderingEdges(graph: ParsedGraph): NormEdge[] {
  const featureIds = new Set(graph.nodes.filter((n) => n.type === 'feature').map((n) => n.id));
  const result: NormEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.type !== 'depends_on' && edge.type !== 'dispatches') continue;
    if (!featureIds.has(edge.from) || !featureIds.has(edge.to)) continue;
    if (edge.type === 'depends_on') {
      result.push({ before: edge.to, after: edge.from, edge });
    } else {
      result.push({ before: edge.from, after: edge.to, edge });
    }
  }
  return result;
}

/**
 * Tarjan's SCC over the normalized "before -> after" adjacency. Any
 * component with more than one member is a genuine mutual dependency that
 * must be planned as a single unit — collapsing it here is what keeps a
 * plain topological sort from silently stranding those nodes instead of
 * erroring.
 */
function tarjanSCC(nodeIds: string[], adjacency: Map<string, Set<string>>): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];

  function strongConnect(v: string): void {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      components.push(component);
    }
  }

  for (const id of nodeIds) {
    if (!indices.has(id)) strongConnect(id);
  }
  return components;
}

interface CombinedEdge {
  u: string;
  v: string;
  describe: string;
}

function edgeKey(u: string, v: string): string {
  return `${u} ${v}`;
}

/**
 * Runs Kahn's-algorithm layered wave assignment over a combined directed
 * graph (nodes, edges). wave(v) = 1 + max(wave(u)) over v's direct
 * predecessors, computed as one unified pass rather than two separate
 * numberings combined afterward. Returns which nodes (if any) never
 * reached zero remaining predecessors — an unresolved cycle slipped
 * through (e.g. one induced by epic-floor edges spanning epics that
 * mutually require each other, which the feature-level SCC pass in step
 * (b) can't see) — leaving the caller to classify and report on them.
 */
function kahnWaves(nodes: string[], edges: CombinedEdge[]): { wave: Map<string, number>; stuck: string[] } {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    indegree.set(n, 0);
    outgoing.set(n, []);
  }
  const seen = new Set<string>();
  for (const { u, v } of edges) {
    const k = edgeKey(u, v);
    if (seen.has(k)) continue;
    seen.add(k);
    outgoing.get(u)!.push(v);
    indegree.set(v, (indegree.get(v) ?? 0) + 1);
  }

  const wave = new Map<string, number>();
  let frontier = nodes.filter((n) => indegree.get(n) === 0);
  let waveNum = 1;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const n of frontier) {
      wave.set(n, waveNum);
      for (const succ of outgoing.get(n)!) {
        indegree.set(succ, indegree.get(succ)! - 1);
        if (indegree.get(succ) === 0) next.push(succ);
      }
    }
    frontier = next;
    waveNum++;
  }

  const stuck = wave.size === nodes.length ? [] : nodes.filter((n) => !wave.has(n));
  return { wave, stuck };
}

interface StuckInfo {
  kind: 'cycle' | 'blocked';
  cycleMembers: string[];
  contributingEdges: string[];
}

/**
 * Kahn's algorithm reports every node that never reached zero remaining
 * predecessors — but that includes nodes merely downstream of a cycle
 * (they never get processed because the cycle ahead of them never
 * resolves), not just the cyclic nodes themselves. A second Tarjan's SCC
 * pass restricted to just the stuck subgraph isolates the true cyclic
 * core(s) from those innocent bystanders, so a feature is only ever told
 * it's "in" a cycle when it actually is.
 */
function classifyStuckGroups(
  stuck: string[],
  groupMembers: Map<string, string[]>,
  combinedEdges: CombinedEdge[]
): Map<string, StuckInfo> {
  const stuckSet = new Set(stuck);
  const inducedAdjacency = new Map<string, Set<string>>();
  for (const n of stuck) inducedAdjacency.set(n, new Set());
  for (const { u, v } of combinedEdges) {
    if (stuckSet.has(u) && stuckSet.has(v)) inducedAdjacency.get(u)!.add(v);
  }

  const inducedComponents = tarjanSCC(stuck, inducedAdjacency);
  const cycles = inducedComponents.filter((c) => c.length > 1);
  const bystanderGroups = inducedComponents.filter((c) => c.length === 1).map((c) => c[0]);

  const result = new Map<string, StuckInfo>();

  for (const cycleGroups of cycles) {
    const groupSet = new Set(cycleGroups);
    const features = cycleGroups.flatMap((g) => groupMembers.get(g) ?? [g]).sort();
    const contributingEdges = combinedEdges
      .filter((e) => groupSet.has(e.u) && groupSet.has(e.v))
      .map((e) => e.describe);
    for (const g of cycleGroups) {
      result.set(g, { kind: 'cycle', cycleMembers: features, contributingEdges });
    }
  }

  if (bystanderGroups.length > 0) {
    const allCyclicFeatures = cycles
      .flatMap((c) => c.flatMap((g) => groupMembers.get(g) ?? [g]))
      .sort();
    for (const g of bystanderGroups) {
      result.set(g, { kind: 'blocked', cycleMembers: allCyclicFeatures, contributingEdges: [] });
    }
  }

  return result;
}

export function computeWaveSkeleton(graph: ParsedGraph): WaveSkeletonResult {
  const featureIds = graph.nodes.filter((n) => n.type === 'feature').map((n) => n.id);
  const epicOf = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.type === 'feature' && n.epic) epicOf.set(n.id, n.epic);
  }

  const normEdges = normalizeOrderingEdges(graph);

  // (a)+(b): real adjacency over individual features, then collapse cycles.
  const realAdjacency = new Map<string, Set<string>>();
  for (const id of featureIds) realAdjacency.set(id, new Set());
  for (const { before, after } of normEdges) {
    realAdjacency.get(before)!.add(after);
  }

  const components = tarjanSCC(featureIds, realAdjacency);
  const groupOf = new Map<string, string>();
  const groupMembers = new Map<string, string[]>();
  for (const component of components) {
    if (component.length === 1) {
      groupOf.set(component[0], component[0]);
      groupMembers.set(component[0], component);
    } else {
      const sorted = [...component].sort();
      const groupId = `cycle-group:${sorted.join(',')}`;
      for (const m of sorted) groupOf.set(m, groupId);
      groupMembers.set(groupId, sorted);
    }
  }

  // Predecessor tracking at the individual-feature level, for provenance.
  const directPredecessors = new Map<string, Array<{ before: string; edge: GraphEdge }>>();
  for (const id of featureIds) directPredecessors.set(id, []);
  for (const { before, after, edge } of normEdges) {
    directPredecessors.get(after)!.push({ before, edge });
  }

  // (c): epic-floor facts, only from actual cross-epic real edges — never
  // from plain epic membership. Each fact becomes a direct synthetic edge
  // from the source feature to every OTHER member of the later epic (not
  // a two-hop node-in-the-middle "milestone" construction — that would add
  // an extra wave of delay per hop, which contradicts waves.md's own worked
  // example: pattern-detective lands one wave after daily-metrics-computation,
  // the same single hop a direct edge would cost, not two). Composing these
  // single-hop edges through the real graph still gets epic-chain
  // transitivity for free, without an explicit re-cascade step.
  const floorPredecessors = new Map<string, Array<{ before: string; edge: GraphEdge; fromEpic: string; toEpic: string }>>();
  for (const id of featureIds) floorPredecessors.set(id, []);

  const combinedEdges: CombinedEdge[] = [];
  for (const { before, after, edge } of normEdges) {
    const gu = groupOf.get(before)!;
    const gv = groupOf.get(after)!;
    if (gu !== gv) combinedEdges.push({ u: gu, v: gv, describe: `${edge.from} ${edge.type} ${edge.to}` });
  }

  for (const { before, after, edge } of normEdges) {
    const fromEpic = epicOf.get(before);
    const toEpic = epicOf.get(after);
    if (!fromEpic || !toEpic || fromEpic === toEpic) continue;

    for (const member of featureIds) {
      if (epicOf.get(member) !== toEpic || member === after) continue;
      const gu = groupOf.get(before)!;
      const gv = groupOf.get(member)!;
      // Skip a self-loop: if `before` and `member` ended up in the same
      // cycle-group (a genuine mutual dependency collapsed in step (b)),
      // this synthetic edge would point a group at itself — which can
      // never reach zero remaining predecessors and would make the group
      // permanently stuck for no real reason, unrelated to any actual
      // cross-epic conflict.
      if (gu === gv) continue;
      combinedEdges.push({
        u: gu,
        v: gv,
        describe:
          `epic-floor: ${toEpic} requires ${fromEpic} (via ${edge.from} ${edge.type} ${edge.to}) — ` +
          `pulls ${member} after ${before}`,
      });
      floorPredecessors.get(member)!.push({ before, edge, fromEpic, toEpic });
    }
  }

  const combinedNodes = [...new Set(groupOf.values())];
  const { wave: waveOfNode, stuck } = kahnWaves(combinedNodes, combinedEdges);
  const maxWave = Math.max(0, ...[...waveOfNode.values()]);
  const stuckClassification = classifyStuckGroups(stuck, groupMembers, combinedEdges);

  // (e): provenance per feature.
  const waves: FeatureWave[] = featureIds.map((featureId) => {
    const groupId = groupOf.get(featureId)!;
    const members = groupMembers.get(groupId)!;
    const reasons: WaveReason[] = [];

    if (members.length > 1) {
      reasons.push({ kind: 'cycle-group', members: members.filter((m) => m !== featureId) });
    }

    const stuckInfo = stuckClassification.get(groupId);
    if (stuckInfo) {
      if (stuckInfo.kind === 'cycle') {
        reasons.push({
          kind: 'unresolved-epic-floor-cycle',
          cycleMembers: stuckInfo.cycleMembers.filter((m) => m !== featureId),
          contributingEdges: stuckInfo.contributingEdges,
        });
      } else {
        reasons.push({ kind: 'blocked-by-unresolved-cycle', cycleMembers: stuckInfo.cycleMembers });
      }
      return { featureId, wave: null, reasons };
    }

    const wave = waveOfNode.get(groupId)!;

    if (members.length === 1) {
      for (const { before, edge } of directPredecessors.get(featureId) ?? []) {
        const predGroup = groupOf.get(before)!;
        const predWave = waveOfNode.get(predGroup);
        if (predWave === wave - 1) {
          reasons.push({ kind: 'direct-edge', predecessorId: before, edge });
        }
      }

      for (const { before, edge, fromEpic, toEpic } of floorPredecessors.get(featureId) ?? []) {
        const predGroup = groupOf.get(before)!;
        const predWave = waveOfNode.get(predGroup);
        if (predWave === wave - 1) {
          reasons.push({ kind: 'epic-floor', predecessorId: before, edge, fromEpic, toEpic });
        }
      }

      if (reasons.length === 0) reasons.push({ kind: 'no-constraint' });
    }

    return { featureId, wave, reasons };
  });

  return { waves, maxWave };
}
