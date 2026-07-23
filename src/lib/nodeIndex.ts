import * as fs from 'fs';
import * as path from 'path';
import { GraphNode, ParsedGraph } from './types';

export interface ListEntry {
  id: string;
  type: string;
  path: string;
  title: string | null;
  description: string | null;
}

const DESCRIPTION_CAP = 120;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (cut > 0) return slice.slice(0, cut + 1).trim();
  return slice.trim() + '…';
}

function isProseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith('#')) return false; // heading
  if (t.startsWith('|')) return false; // table row
  if (t.startsWith('```')) return false; // code fence
  if (/^-{3,}$/.test(t)) return false; // horizontal rule
  return true;
}

/**
 * Extracts a title and short description from an asset file without
 * depending on any specific heading name. The `# Title` line is the one
 * structural guarantee (structure_reference.md §7); everything below it is
 * documented as "a strong default, not a hard requirement," so the
 * description is just "the first paragraph of actual prose after the
 * title," whatever it's under or not under. Degrades to nulls rather than
 * throwing when nothing matches.
 */
export function extractTitleAndDescription(content: string): { title: string | null; description: string | null } {
  const lines = content.split('\n');

  let title: string | null = null;
  let titleLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+)$/);
    if (m) {
      title = m[1].trim();
      titleLineIdx = i;
      break;
    }
  }
  if (title === null) return { title: null, description: null };

  let description: string | null = null;
  for (let i = titleLineIdx + 1; i < lines.length; i++) {
    if (!isProseLine(lines[i])) continue;
    const paraLines: string[] = [];
    let j = i;
    while (j < lines.length && isProseLine(lines[j])) {
      paraLines.push(lines[j].trim());
      j++;
    }
    description = truncate(paraLines.join(' '), DESCRIPTION_CAP);
    break;
  }

  return { title, description };
}

export function buildListEntries(graph: ParsedGraph, specRoot: string, typeFilter?: string): ListEntry[] {
  const nodes: GraphNode[] = typeFilter ? graph.nodes.filter((n) => n.type === typeFilter) : graph.nodes;

  return nodes.map((n) => {
    const fullPath = path.join(specRoot, n.path);
    let title: string | null = null;
    let description: string | null = null;
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      ({ title, description } = extractTitleAndDescription(content));
    }
    return { id: n.id, type: n.type, path: n.path, title, description };
  });
}
