import { loadGraph } from '../lib/graph';
import { resolveShowIds, computeShow, ShowDirection, ShowResult } from '../lib/traverse';

export interface ShowOptions {
  json?: boolean;
  direction?: string;
}

const VALID_DIRECTIONS: ShowDirection[] = ['forward', 'reverse', 'both'];

export function showCommand(idsArg: string, options: ShowOptions): void {
  const root = process.cwd();
  const ids = idsArg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    console.log('Usage: traverspec show <node_id>[,<node_id>...] [--direction forward|reverse|both]');
    process.exitCode = 1;
    return;
  }

  const direction = (options.direction ?? 'both') as ShowDirection;
  if (!VALID_DIRECTIONS.includes(direction)) {
    console.log(`traverspec show: --direction must be one of ${VALID_DIRECTIONS.join(', ')}, got '${options.direction}'`);
    process.exitCode = 1;
    return;
  }

  const graph = loadGraph(root);
  const { errors } = resolveShowIds(ids, graph);

  if (errors.length) {
    console.log('traverspec show: cannot resolve the requested node id(s).\n');
    errors.forEach((e) => console.log(`  ${e}`));
    process.exitCode = 1;
    return;
  }

  const result = computeShow(ids, graph, direction);
  report(result, options);
}

function report(result: ShowResult, options: ShowOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`traverspec show: ${result.coveredNodes} of ${result.totalNodes} nodes covered.\n`);
  for (const { level, nodes, edges } of result.levels) {
    console.log(`level ${level}:`);
    if (nodes.length) {
      console.log('  nodes:');
      for (const n of nodes) console.log(`    - ${n}`);
    }
    console.log('  edges:');
    for (const e of edges) {
      console.log(`    - from: ${e.from}`);
      console.log(`      type: ${e.type}`);
      console.log(`      to: ${e.to}`);
    }
    console.log('');
  }
}
