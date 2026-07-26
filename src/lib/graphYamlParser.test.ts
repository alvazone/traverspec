import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { parseGraphYamlText, GraphYamlParseError } from './graphYamlParser';
import { ParsedGraph } from './types';

function loadWithJsYaml(text: string): ParsedGraph {
  const raw = yaml.load(text) as Partial<ParsedGraph> | null | undefined;
  return {
    epics: raw?.epics ?? [],
    nodes: raw?.nodes ?? [],
    edges: raw?.edges ?? [],
  };
}

const FIXTURES_ROOT = path.join(__dirname, '..', '..', 'test-fixtures');

function allFixtureGraphPaths(): string[] {
  const paths: string[] = [];
  for (const dir of fs.readdirSync(FIXTURES_ROOT)) {
    const p = path.join(FIXTURES_ROOT, dir, 'traverspec', 'graph.yaml');
    if (fs.existsSync(p)) paths.push(p);
  }
  return paths;
}

describe('parseGraphYamlText — differential against js-yaml (loadGraph ground truth)', () => {
  for (const graphPath of allFixtureGraphPaths()) {
    it(`matches js-yaml output for ${path.relative(FIXTURES_ROOT, graphPath)}`, () => {
      const text = fs.readFileSync(graphPath, 'utf8');
      expect(parseGraphYamlText(text)).toEqual(loadWithJsYaml(text));
    });
  }
});

describe('parseGraphYamlText — edge cases, differential against js-yaml', () => {
  const cases: Record<string, string> = {
    'all sections explicitly empty': `epics: []\nnodes: []\nedges: []\n`,

    'node with no optional epic field, mixed with one that has it': `epics:
  - id: epic:billing
    name: Billing
    path: assets/epic/billing.md

nodes:
  - id: feature:checkout
    type: feature
    epic: epic:billing
    path: assets/feature/checkout.md

  - id: data_model:Order
    type: data_model
    path: assets/data_model/Order.md

edges: []
`,

    'single-item lists, no trailing blank line': `epics: []
nodes:
  - id: feature:solo
    type: feature
    path: assets/feature/solo.md
edges: []`,

    'extra blank lines and whole-line comments interspersed': `epics: []

# a comment line
nodes:

  - id: feature:a
    type: feature
    path: assets/feature/a.md
  # another comment, between items

  - id: feature:b
    type: feature
    path: assets/feature/b.md

edges:
  - from: feature:a
    type: depends_on
    to: feature:b
`,

    'CRLF line endings': [
      'epics: []',
      'nodes:',
      '  - id: feature:a',
      '    type: feature',
      '    path: assets/feature/a.md',
      'edges: []',
      '',
    ].join('\r\n'),

    'sections in non-standard order': `nodes:
  - id: feature:a
    type: feature
    path: assets/feature/a.md

edges: []

epics: []
`,
  };

  for (const [name, text] of Object.entries(cases)) {
    it(name, () => {
      expect(parseGraphYamlText(text)).toEqual(loadWithJsYaml(text));
    });
  }
});

describe('parseGraphYamlText — fails loud on unsupported constructs instead of guessing', () => {
  const badCases: Record<string, string> = {
    'flow-style mapping value': `nodes:\n  - id: feature:a\n    type: feature\n    path: {a: b}\n`,
    'quoted string value': `nodes:\n  - id: feature:a\n    type: feature\n    path: "assets/feature/a.md"\n`,
    'block scalar value': `nodes:\n  - id: feature:a\n    type: feature\n    path: |\n      assets/feature/a.md\n`,
    'anchor marker': `nodes:\n  - id: feature:a\n    type: feature\n    path: &anchor assets/feature/a.md\n`,
    'document marker': `---\nnodes: []\n`,
    'unrecognized top-level key': `widgets:\n  - id: x\n`,
  };

  for (const [name, text] of Object.entries(badCases)) {
    it(name, () => {
      expect(() => parseGraphYamlText(text)).toThrow(GraphYamlParseError);
    });
  }
});
