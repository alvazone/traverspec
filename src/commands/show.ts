import * as fs from 'fs';
import * as path from 'path';
import { loadGraph } from '../lib/graph';
import { resolveShowIds, computeShow, ShowDirection, ShowResult } from '../lib/traverse';

export interface ShowOptions {
  json?: boolean;
  direction?: string;
}

interface CommandError {
  what: string;
  where: string;
  fix: string;
}

const VALID_DIRECTIONS: ShowDirection[] = ['forward', 'reverse', 'both'];

export function showCommand(idsArg: string, options: ShowOptions): void {
  const root = process.cwd();
  const specRoot = path.join(root, 'traverspec');
  const graphPath = path.join(specRoot, 'graph.yaml');

  const ids = idsArg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return reportError(
      {
        what: 'no node id was provided.',
        where: "the `show` command's <node_ids> argument.",
        fix: 'run `traverspec show <node_id>[,<node_id>...]` with at least one node id (comma-separated for more than one). Run `traverspec list` first if you need to find a valid id.',
      },
      options
    );
  }

  const direction = (options.direction ?? 'both') as ShowDirection;
  if (!VALID_DIRECTIONS.includes(direction)) {
    return reportError(
      {
        what: `'--direction ${options.direction}' is not a recognized direction.`,
        where: '--direction command-line option.',
        fix: `use one of: ${VALID_DIRECTIONS.join(', ')} (default: both).`,
      },
      options
    );
  }

  if (!fs.existsSync(graphPath)) {
    return reportError(
      {
        what: 'traverspec/graph.yaml not found.',
        where: `expected at ${graphPath}.`,
        fix: "run `traverspec init` to scaffold it, or run this command from the project root if you're not there already.",
      },
      options
    );
  }

  let result: ShowResult;
  try {
    const graph = loadGraph(root);
    const { errors } = resolveShowIds(ids, graph);
    if (errors.length) {
      return reportError(
        {
          what: `cannot resolve ${errors.length === 1 ? 'this node id' : 'these node ids'}:\n  - ${errors.join('\n  - ')}`,
          where: 'the <node_ids> argument passed to `traverspec show`.',
          fix: 'run `traverspec list` to see every valid node id, then retry with a correct one.',
        },
        options
      );
    }
    result = computeShow(ids, graph, direction);
  } catch (err: any) {
    return reportError(
      {
        what: `couldn't read traverspec/graph.yaml — ${err.message}`,
        where: graphPath,
        fix: "run `traverspec validate` for a full diagnosis of what's wrong, then fix what it reports.",
      },
      options
    );
  }

  report(result, options);
}

function reportError(error: CommandError, options: ShowOptions): void {
  if (options.json) {
    console.log(JSON.stringify({ error }, null, 2));
  } else {
    console.error(`traverspec show failed: ${error.what}\nWhere: ${error.where}\nFix: ${error.fix}`);
  }
  process.exitCode = 1;
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
