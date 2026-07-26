import { GraphEpic, GraphNode, GraphEdge, ParsedGraph } from './types';

/**
 * Self-contained parser for traverspec/graph.yaml, with zero external
 * dependencies (no js-yaml). Exists because this parser is the one piece
 * of wave-skeleton logic that ships as a bundled skill script into other
 * people's projects (see templates/skills/traverspec-waves/scripts/), where
 * we can't assume any package beyond Node's own stdlib is resolvable.
 *
 * This is deliberately NOT a general YAML parser. It supports exactly the
 * narrow, flat subset graph.yaml actually uses in practice (verified
 * against every fixture in this repo and a real 2,263-line/192-node
 * production graph): three top-level block sequences (`epics`, `nodes`,
 * `edges`), each item a flat mapping of plain scalar `key: value` lines,
 * plus the `key: []` idiom for an empty sequence. Anything outside that —
 * quoted strings, flow-style `{}`/`[]` (other than the empty-sequence
 * idiom), block scalars (`|`/`>`), anchors/aliases/tags, multi-document
 * markers — throws a clear GraphYamlParseError rather than silently
 * guessing. A silent wrong parse here is a worse failure than a loud one:
 * this project has been burned before by mechanical logic that looked
 * complete and was quietly wrong (see waves.md's own Step 1 history).
 */
export class GraphYamlParseError extends Error {
  constructor(message: string, lineNumber?: number) {
    super(lineNumber !== undefined ? `graph.yaml line ${lineNumber}: ${message}` : `graph.yaml: ${message}`);
    this.name = 'GraphYamlParseError';
  }
}

const TOP_LEVEL_KEYS = ['epics', 'nodes', 'edges'] as const;
type TopLevelKey = (typeof TOP_LEVEL_KEYS)[number];

const UNSUPPORTED_VALUE_PREFIXES = ['{', '[', '|', '>', '&', '*', '!', "'", '"'];

interface RawItem {
  fields: Record<string, string>;
  lineNumber: number;
}

const VALIDATE_POINTER = 'Then run `traverspec validate` to confirm the fix.';

function stripUnsupportedMarkers(text: string, lineNumber: number): void {
  const trimmed = text.trim();
  if (trimmed === '---' || trimmed === '...') {
    throw new GraphYamlParseError(
      `this line is a YAML document marker ('${trimmed}'), which this lightweight parser doesn't support. ` +
        `Fix: delete this line — graph.yaml must be a single document with no document markers. ${VALIDATE_POINTER}`,
      lineNumber
    );
  }
}

function assertSupportedValue(value: string, lineNumber: number): void {
  if (value === '') return;
  const first = value[0];
  if (UNSUPPORTED_VALUE_PREFIXES.includes(first)) {
    throw new GraphYamlParseError(
      `this value starts with '${first}', which is YAML quoting/flow-style/block-scalar/anchor syntax this ` +
        `lightweight parser can't read. Fix: rewrite it as a plain unquoted scalar, matching the format used ` +
        `elsewhere in graph.yaml (e.g. 'path: assets/feature/x.md', not a quoted or bracketed value). ${VALIDATE_POINTER}`,
      lineNumber
    );
  }
}

/**
 * Parses the plain-text contents of graph.yaml into a ParsedGraph, using
 * only string operations (no external YAML library). Throws
 * GraphYamlParseError on anything outside the supported subset.
 */
export function parseGraphYamlText(text: string): ParsedGraph {
  const lines = text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));

  const sections: Record<TopLevelKey, RawItem[]> = { epics: [], nodes: [], edges: [] };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    stripUnsupportedMarkers(rawLine, lineNumber);

    // Only accept top-level keys at column 0 — anything else at column 0
    // that isn't a recognized section header is unsupported top-level shape.
    const topMatch = rawLine.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!rawLine.match(/^\S/) || !topMatch) {
      throw new GraphYamlParseError(
        `this line doesn't start with a recognized top-level key (${TOP_LEVEL_KEYS.join(
          '/'
        )}: ...), found: "${rawLine}". Fix: rewrite this line so it starts one of those three sections, or delete ` +
          `it if it's stray content that doesn't belong in graph.yaml. ${VALIDATE_POINTER}`,
        lineNumber
      );
    }

    const key = topMatch[1];
    const rest = topMatch[2].trim();
    if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      throw new GraphYamlParseError(
        `'${key}:' isn't a section graph.yaml supports — only ${TOP_LEVEL_KEYS.join(', ')} are valid. ` +
          `Fix: rename this section to one of those, or delete it. ${VALIDATE_POINTER}`,
        lineNumber
      );
    }
    const sectionKey = key as TopLevelKey;
    i++;

    if (rest === '[]') {
      continue; // explicit empty sequence — nothing more to consume for this section
    }
    if (rest !== '') {
      throw new GraphYamlParseError(
        `'${key}:' should be followed by nothing (a list of items on the following lines) or '[]' for an empty ` +
          `list, but has trailing content: "${rest}". Fix: move that content onto its own indented '- key: value' ` +
          `line below, or delete it. ${VALIDATE_POINTER}`,
        lineNumber
      );
    }

    // Consume the block sequence: skip blank/comment lines, then read items.
    let itemIndent: number | null = null;
    let fieldIndent: number | null = null;

    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();
      if (t === '' || t.startsWith('#')) {
        i++;
        continue;
      }

      const dashMatch = line.match(/^(\s*)-\s+([a-zA-Z_]+):\s?(.*)$/);
      if (!dashMatch) {
        // Not a new item — either a new top-level section, or invalid shape.
        if (line.match(/^\S/)) break; // new top-level key, let the outer loop handle it
        throw new GraphYamlParseError(
          `expected a list item ('- key: value') or a new top-level key here, found: "${line}". Fix: correct this ` +
            `line's formatting to match a list item (e.g. '  - id: ...'), or delete it. ${VALIDATE_POINTER}`,
          i + 1
        );
      }

      const indent = dashMatch[1].length;
      if (itemIndent === null) itemIndent = indent;
      if (indent !== itemIndent) {
        throw new GraphYamlParseError(
          `this list item's '-' is indented ${indent} spaces, but earlier items in '${sectionKey}' use ${itemIndent}. ` +
            `Fix: change this line's indentation to ${itemIndent} spaces to match the rest of the section. ${VALIDATE_POINTER}`,
          i + 1
        );
      }

      const item: RawItem = { fields: {}, lineNumber: i + 1 };
      const firstKey = dashMatch[2];
      const firstValue = dashMatch[3].trim();
      assertSupportedValue(firstValue, i + 1);
      item.fields[firstKey] = firstValue;
      i++;

      // Subsequent field lines for this item, at a deeper, consistent indent.
      while (i < lines.length) {
        const fLine = lines[i];
        const ft = fLine.trim();
        if (ft === '' || ft.startsWith('#')) {
          i++;
          continue;
        }
        if (fLine.match(/^(\s*)-\s+[a-zA-Z_]+:/)) break; // next item
        if (fLine.match(/^\S/)) break; // next top-level key

        const fieldMatch = fLine.match(/^(\s+)([a-zA-Z_]+):\s?(.*)$/);
        if (!fieldMatch) {
          throw new GraphYamlParseError(
            `expected a 'key: value' field line within a list item here, found: "${fLine}". Fix: correct this ` +
              `line's formatting to a plain 'key: value' field. ${VALIDATE_POINTER}`,
            i + 1
          );
        }
        const fIndent = fieldMatch[1].length;
        if (fieldIndent === null) fieldIndent = fIndent;
        if (fIndent !== fieldIndent) {
          throw new GraphYamlParseError(
            `this field is indented ${fIndent} spaces, but earlier fields in '${sectionKey}' use ${fieldIndent}. ` +
              `Fix: change this line's indentation to ${fieldIndent} spaces to match the rest of the section. ${VALIDATE_POINTER}`,
            i + 1
          );
        }
        if (fIndent <= itemIndent) break; // shallower than the item itself — treat as next construct

        const fKey = fieldMatch[2];
        const fValue = fieldMatch[3].trim();
        assertSupportedValue(fValue, i + 1);
        item.fields[fKey] = fValue;
        i++;
      }

      sections[sectionKey].push(item);
    }
  }

  return {
    epics: sections.epics.map((item) => toEpic(item)),
    nodes: sections.nodes.map((item) => toNode(item)),
    edges: sections.edges.map((item) => toEdge(item)),
  };
}

function requireField(item: RawItem, key: string, context: string): string {
  const value = item.fields[key];
  if (value === undefined || value === '') {
    throw new GraphYamlParseError(
      `this ${context} is missing the required field '${key}'. Fix: add '${key}: <value>' to this entry. ${VALIDATE_POINTER}`,
      item.lineNumber
    );
  }
  return value;
}

function toEpic(item: RawItem): GraphEpic {
  return {
    id: requireField(item, 'id', 'epic entry'),
    name: requireField(item, 'name', 'epic entry'),
    path: requireField(item, 'path', 'epic entry'),
  };
}

function toNode(item: RawItem): GraphNode {
  const node: GraphNode = {
    id: requireField(item, 'id', 'node entry'),
    type: requireField(item, 'type', 'node entry') as GraphNode['type'],
    path: requireField(item, 'path', 'node entry'),
  };
  if (item.fields.epic) node.epic = item.fields.epic;
  return node;
}

function toEdge(item: RawItem): GraphEdge {
  return {
    from: requireField(item, 'from', 'edge entry'),
    type: requireField(item, 'type', 'edge entry') as GraphEdge['type'],
    to: requireField(item, 'to', 'edge entry'),
  };
}
