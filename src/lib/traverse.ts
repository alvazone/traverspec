import { GraphEdge, ParsedGraph } from './types';

export type ShowDirection = 'forward' | 'reverse' | 'both';

export interface ShowLevel {
  level: number;
  nodes: string[];
  edges: GraphEdge[];
}

export interface ShowResult {
  levels: ShowLevel[];
  coveredNodes: number;
  totalNodes: number;
}

export interface ResolveIdsResult {
  errors: string[];
}

function edgeKey(e: GraphEdge): string {
  return `${e.from} ${e.type} ${e.to}`;
}

function buildIndex(edges: GraphEdge[]): { outgoing: Map<string, GraphEdge[]>; incoming: Map<string, GraphEdge[]> } {
  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from)!.push(e);
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to)!.push(e);
  }
  return { outgoing, incoming };
}

/**
 * Breadth-first walk in one direction only — never both — assigning every
 * node the level it was first reached at (level 1 = directly connected to
 * a start id), and collecting every edge traversed along the way. Mixing
 * directions mid-walk would flood-fill into unrelated nodes that merely
 * share a neighbor with the walk so far, not nodes actually connected to
 * the start set — e.g. reaching a data model through a `mutates` edge and
 * then also looking at everything else with a `foreign_key` into that same
 * data model. That's exactly why 'both' mode below runs this twice, once
 * per direction, and merges the results afterward, rather than exploring
 * both directions from every node in a single combined walk.
 */
function directionalWalk(
  startIds: string[],
  index: Map<string, GraphEdge[]>,
  nextId: (e: GraphEdge) => string
): { nodeLevel: Map<string, number>; edges: Map<string, GraphEdge> } {
  const nodeLevel = new Map<string, number>();
  for (const id of startIds) nodeLevel.set(id, 0);
  const edges = new Map<string, GraphEdge>();

  let frontier = [...startIds];
  let level = 0;
  while (frontier.length) {
    level++;
    const nextFrontier: string[] = [];
    for (const current of frontier) {
      for (const e of index.get(current) || []) {
        edges.set(edgeKey(e), e);
        const next = nextId(e);
        if (!nodeLevel.has(next)) {
          nodeLevel.set(next, level);
          nextFrontier.push(next);
        }
      }
    }
    frontier = nextFrontier;
  }

  return { nodeLevel, edges };
}

/**
 * Validates every requested id exists as a node (not an epic — epics are
 * filtering labels, never part of the edge graph, see structure_reference.md
 * §4). Returns every problem found, not just the first, so a multi-id call
 * reports everything wrong in one pass.
 */
export function resolveShowIds(ids: string[], graph: ParsedGraph): ResolveIdsResult {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const epicIds = new Set(graph.epics.map((e) => e.id));
  const errors: string[] = [];
  for (const id of ids) {
    if (nodeIds.has(id)) continue;
    if (epicIds.has(id)) {
      errors.push(`'${id}' is an epic, a filtering label, not a traversable node`);
    } else {
      errors.push(`'${id}' does not exist in graph.yaml`);
    }
  }
  return { errors };
}

/**
 * Transitive closure for one or more starting node ids, grouped by level
 * (hop distance) rather than returned as one flat list. `direction` mirrors
 * traversal_policy.md's own task-type distinction — 'forward' for
 * implement/explain tasks, 'reverse' for impact-analysis tasks, 'both'
 * when genuinely uncertain or the full picture is needed. Each direction
 * requested is still fully transitive, no depth cap.
 *
 * In 'both' mode, the forward and reverse walks are computed independently
 * (see directionalWalk's note on why) and merged afterward: a node's level
 * is the shortest distance found by either walk. An edge's level is then
 * the *larger* of its two endpoints' final levels, not "anchor level plus
 * one" — an edge connecting two nodes that are both already known at the
 * same level belongs at that level, not one level deeper just because of
 * which of the two happened to be processed first when the edge was found.
 * (An earlier version used anchor-plus-one and mislabeled roughly a third
 * of edges on a real graph as a result — every edge with both endpoints
 * already at the same level got pushed one level too deep.)
 *
 * `overrides` is checked bidirectionally on every node reached regardless
 * of `direction` (per traversal_policy.md, it's a separate, always-on
 * correction, not part of the forward/reverse distinction). An overrides
 * pair is attached to the same level as the node that triggered the check,
 * not one level further out — the policy treats it as something checked
 * the moment a node is loaded, not a further hop away from it. It's a
 * one-hop addition per node, not recursively re-expanded from the paired
 * node, which would reintroduce the same flood-fill problem a
 * combined-direction walk has.
 */
export function computeShow(ids: string[], graph: ParsedGraph, direction: ShowDirection = 'both'): ShowResult {
  const { outgoing, incoming } = buildIndex(graph.edges);

  const forward =
    direction === 'forward' || direction === 'both'
      ? directionalWalk(ids, outgoing, (e) => e.to)
      : { nodeLevel: new Map<string, number>(), edges: new Map<string, GraphEdge>() };
  const reverse =
    direction === 'reverse' || direction === 'both'
      ? directionalWalk(ids, incoming, (e) => e.from)
      : { nodeLevel: new Map<string, number>(), edges: new Map<string, GraphEdge>() };

  const nodeLevel = new Map<string, number>();
  for (const [id, lvl] of [...forward.nodeLevel, ...reverse.nodeLevel]) {
    const existing = nodeLevel.get(id);
    if (existing === undefined || lvl < existing) nodeLevel.set(id, lvl);
  }

  const edges = new Map<string, GraphEdge>([...forward.edges, ...reverse.edges]);

  for (const [nodeId, lvl] of [...nodeLevel.entries()]) {
    for (const e of outgoing.get(nodeId) || []) {
      if (e.type !== 'overrides') continue;
      edges.set(edgeKey(e), e);
      if (!nodeLevel.has(e.to)) nodeLevel.set(e.to, lvl);
    }
    for (const e of incoming.get(nodeId) || []) {
      if (e.type !== 'overrides') continue;
      edges.set(edgeKey(e), e);
      if (!nodeLevel.has(e.from)) nodeLevel.set(e.from, lvl);
    }
  }

  const edgesByLevel = new Map<number, GraphEdge[]>();
  for (const e of edges.values()) {
    const level = Math.max(nodeLevel.get(e.from) ?? 0, nodeLevel.get(e.to) ?? 0);
    if (!edgesByLevel.has(level)) edgesByLevel.set(level, []);
    edgesByLevel.get(level)!.push(e);
  }

  const nodesByLevel = new Map<number, string[]>();
  for (const [nodeId, level] of nodeLevel) {
    if (level === 0) continue; // start ids aren't "discovered" at any level
    if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
    nodesByLevel.get(level)!.push(nodeId);
  }

  const levels: ShowLevel[] = [...edgesByLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      nodes: nodesByLevel.get(level) ?? [],
      edges: edgesByLevel.get(level)!,
    }));

  return {
    levels,
    coveredNodes: nodeLevel.size,
    totalNodes: graph.nodes.length,
  };
}
