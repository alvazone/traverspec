import * as fs from 'fs';
import * as path from 'path';
import { loadGraph } from '../lib/graph';
import { buildListEntries, ListEntry } from '../lib/nodeIndex';
import { NODE_TYPES } from '../lib/types';

export interface ListOptions {
  json?: boolean;
  type?: string;
}

interface CommandError {
  what: string;
  where: string;
  fix: string;
}

export function listCommand(options: ListOptions): void {
  const root = process.cwd();
  const specRoot = path.join(root, 'traverspec');
  const graphPath = path.join(specRoot, 'graph.yaml');

  if (options.type && !(NODE_TYPES as readonly string[]).includes(options.type)) {
    return reportError(
      {
        what: `'--type ${options.type}' is not a recognized node type.`,
        where: 'command-line argument.',
        fix: `use one of: ${NODE_TYPES.join(', ')} — or omit --type to list every node.`,
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

  let entries: ListEntry[];
  try {
    const graph = loadGraph(root);
    entries = buildListEntries(graph, specRoot, options.type);
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

  report(entries, options);
}

function reportError(error: CommandError, options: ListOptions): void {
  if (options.json) {
    console.log(JSON.stringify({ error }, null, 2));
  } else {
    console.error(`traverspec list failed: ${error.what}\nWhere: ${error.where}\nFix: ${error.fix}`);
  }
  process.exitCode = 1;
}

function report(entries: ListEntry[], options: ListOptions): void {
  if (options.json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log('traverspec list: no nodes found.');
    return;
  }

  for (const e of entries) {
    const title = e.assetError ? `(${e.assetError})` : e.title ?? '(no title found)';
    const description = e.description ? ` — ${e.description}` : '';
    console.log(`${e.id}  [${e.type}]  ${title}${description}`);
  }
}
