import * as path from 'path';
import { loadGraph } from '../lib/graph';
import { buildListEntries, ListEntry } from '../lib/nodeIndex';

export interface ListOptions {
  json?: boolean;
  type?: string;
}

export function listCommand(options: ListOptions): void {
  const root = process.cwd();
  const specRoot = path.join(root, 'traverspec');
  const graph = loadGraph(root);

  const entries = buildListEntries(graph, specRoot, options.type);
  report(entries, options);
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
    const title = e.title ?? '(no title found)';
    const description = e.description ? ` — ${e.description}` : '';
    console.log(`${e.id}  [${e.type}]  ${title}${description}`);
  }
}
