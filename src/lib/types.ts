export const NODE_TYPES = [
  'epic',
  'feature',
  'data_model',
  'api_contract',
  'business_rule',
  'decision',
  'ui_component',
] as const;

export const EDGE_TYPES = [
  'depends_on',
  'mutates',
  'reads',
  'triggers',
  'enforces',
  'foreign_key',
  'calls',
  'overrides',
  'dispatches',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];
export type EdgeType = (typeof EDGE_TYPES)[number];

export interface GraphEpic {
  id: string;
  name: string;
  path: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  path: string;
  epic?: string;
}

export interface GraphEdge {
  from: string;
  type: EdgeType;
  to: string;
}

export interface ParsedGraph {
  epics: GraphEpic[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}
