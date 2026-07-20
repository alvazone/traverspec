import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ParsedGraph } from './types';

/**
 * Parses traverspec/graph.yaml into a typed ParsedGraph. This does minimal
 * sanity handling (missing epics/nodes/edges default to empty arrays) but
 * is not a substitute for `traverspec validate` — it doesn't check
 * referential integrity, legal types, or anything else. Consumers that
 * need to know the graph is actually well-formed should run validate
 * separately, not rely on loadGraph having done that for them.
 */
export function loadGraph(root: string): ParsedGraph {
  const graphPath = path.join(root, 'traverspec', 'graph.yaml');
  const raw = yaml.load(fs.readFileSync(graphPath, 'utf8')) as Partial<ParsedGraph> | null | undefined;

  return {
    epics: raw?.epics ?? [],
    nodes: raw?.nodes ?? [],
    edges: raw?.edges ?? [],
  };
}
