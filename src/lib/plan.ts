import { ParsedGraph, GraphNode } from './types';

export type GroupReason = 'single' | 'cycle' | 'dispatch' | 'cycle+dispatch';

export interface PlanGroup {
  members: string[]; // feature ids, sorted for determinism
  reason: GroupReason;
}

export interface PlanWave {
  waveNumber: number;
  groups: PlanGroup[];
}

export interface PlanResult {
  waves: PlanWave[];
}

/**
 * Computes a dependency-respecting build order over feature nodes.
 *
 * Grouping: a single strongly-connected-components pass over one combined
 * graph — depends_on edges as directed, dispatches edges added in BOTH
 * directions (since a dispatched pair should be planned as a unit
 * regardless of which side "started" it). This correctly handles a real
 * depends_on cycle, a direct dispatches pair, and the cascading case where
 * a depends_on chain plus one dispatches edge creates a cycle that didn't
 * exist in either edge type alone — all in one pass, no iteration needed,
 * since condensing a graph's SCCs always yields a DAG.
 *
 * Ordering: only depends_on edges between DIFFERENT groups feed the wave
 * placement (Kahn's algorithm on the condensed graph). Dispatches edges
 * are used only for grouping, never for ordering between groups that
 * aren't already unioned — a dispatches relationship doesn't imply one
 * group must be scheduled before another the way depends_on does.
 */
export function computePlan(graph: ParsedGraph): PlanResult {
  const features = graph.nodes.filter((n) => n.type === 'feature');
  const featureIds = new Set(features.map((n) => n.id));

  const dependsOnEdges = graph.edges.filter(
    (e) => e.type === 'depends_on' && featureIds.has(e.from) && featureIds.has(e.to)
  );
  const dispatchesEdges = graph.edges.filter(
    (e) => e.type === 'dispatches' && featureIds.has(e.from) && featureIds.has(e.to)
  );

  // Combined graph for SCC/grouping purposes only.
  const combinedAdj = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    if (!combinedAdj.has(from)) combinedAdj.set(from, new Set());
    combinedAdj.get(from)!.add(to);
  };
  for (const e of dependsOnEdges) addEdge(e.from, e.to);
  for (const e of dispatchesEdges) {
    addEdge(e.from, e.to);
    addEdge(e.to, e.from);
  }

  const sccs = tarjanSCC(Array.from(featureIds), combinedAdj);

  const groupOf = new Map<string, number>(); // feature id -> scc index
  sccs.forEach((scc, i) => scc.forEach((id) => groupOf.set(id, i)));

  // Determine why each multi-member group is grouped: does a real
  // depends_on-only cycle exist among just these members, independent of
  // any dispatches edge?
  const dependsOnOnlyAdj = new Map<string, Set<string>>();
  for (const e of dependsOnEdges) {
    if (!dependsOnOnlyAdj.has(e.from)) dependsOnOnlyAdj.set(e.from, new Set());
    dependsOnOnlyAdj.get(e.from)!.add(e.to);
  }
  const dispatchPairs = new Set<string>();
  for (const e of dispatchesEdges) {
    dispatchPairs.add(`${e.from}|${e.to}`);
    dispatchPairs.add(`${e.to}|${e.from}`);
  }

  const groups: PlanGroup[] = sccs.map((members) => {
    const sorted = [...members].sort();
    if (sorted.length === 1) {
      return { members: sorted, reason: 'single' };
    }
    const memberSet = new Set(sorted);
    const hasDependsOnCycle =
      tarjanSCC(sorted, restrictAdjacency(dependsOnOnlyAdj, memberSet)).some((scc) => scc.length > 1);
    const hasDispatch = sorted.some((a) => sorted.some((b) => a !== b && dispatchPairs.has(`${a}|${b}`)));

    let reason: GroupReason;
    if (hasDependsOnCycle && hasDispatch) reason = 'cycle+dispatch';
    else if (hasDependsOnCycle) reason = 'cycle';
    else reason = 'dispatch';

    return { members: sorted, reason };
  });

  // Condensed depends_on graph between different groups.
  const groupCount = groups.length;
  const dependsOnGroups: Set<number>[] = Array.from({ length: groupCount }, () => new Set<number>());
  const dependentsOfGroup: Set<number>[] = Array.from({ length: groupCount }, () => new Set<number>());

  for (const e of dependsOnEdges) {
    const gFrom = groupOf.get(e.from)!;
    const gTo = groupOf.get(e.to)!;
    if (gFrom === gTo) continue; // internal to a group, no ordering needed
    dependsOnGroups[gFrom].add(gTo);
    dependentsOfGroup[gTo].add(gFrom);
  }

  // Kahn's algorithm on the condensed graph. Guaranteed acyclic since
  // condensing a graph's SCCs always yields a DAG — no leftover case.
  const remaining = dependsOnGroups.map((deps) => deps.size);
  const waves: PlanWave[] = [];
  const placed = new Set<number>();
  let waveNumber = 1;

  let frontier = remaining
    .map((count, i) => (count === 0 ? i : -1))
    .filter((i) => i !== -1);

  while (frontier.length > 0) {
    waves.push({
      waveNumber,
      groups: frontier
        .map((i) => groups[i])
        .sort((a, b) => a.members[0].localeCompare(b.members[0])),
    });
    frontier.forEach((i) => placed.add(i));

    const next = new Set<number>();
    for (const i of frontier) {
      for (const dependent of dependentsOfGroup[i]) {
        if (placed.has(dependent)) continue;
        remaining[dependent] -= 1;
        if (remaining[dependent] === 0) next.add(dependent);
      }
    }
    frontier = Array.from(next);
    waveNumber++;
  }

  return { waves };
}

function restrictAdjacency(adj: Map<string, Set<string>>, allowed: Set<string>): Map<string, Set<string>> {
  const restricted = new Map<string, Set<string>>();
  for (const [from, tos] of adj) {
    if (!allowed.has(from)) continue;
    const filtered = new Set(Array.from(tos).filter((to) => allowed.has(to)));
    restricted.set(from, filtered);
  }
  return restricted;
}

/** Tarjan's strongly-connected-components algorithm. */
function tarjanSCC(nodeIds: string[], adj: Map<string, Set<string>>): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongconnect(v: string) {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) || []) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const v of nodeIds) {
    if (!indices.has(v)) strongconnect(v);
  }

  return sccs;
}
