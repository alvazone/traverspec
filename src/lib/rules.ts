import * as fs from 'fs';
import * as path from 'path';
import { NODE_TYPES, EDGE_TYPES } from './types';

export interface Finding {
  rule: string;
  message: string;
}

export { NODE_TYPES, EDGE_TYPES };

export const REQUIRED_SKILL_FILES = [
  'start_here.md',
  'structure_reference.md',
  'traversal_policy.md',
  'ingest_spec.md',
  'author_via_chat.md',
  'derive_spec_from_code.md',
  'plan.md',
];

function isScalar(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && !Array.isArray(value));
}

function checkShape(
  entries: any[],
  allowedKeys: string[],
  requiredKeys: string[],
  label: (entry: any) => string
): Finding[] {
  const findings: Finding[] = [];
  for (const entry of entries) {
    const keys = Object.keys(entry ?? {});
    const extra = keys.filter((k) => !allowedKeys.includes(k));
    const missing = requiredKeys.filter((k) => !keys.includes(k));
    if (extra.length || missing.length) {
      findings.push({
        rule: 'structural-shape',
        message: `${label(entry)} has unexpected shape (extra keys: [${extra.join(', ')}], missing: [${missing.join(', ')}])`,
      });
    }
    for (const k of keys) {
      if (!isScalar(entry[k])) {
        findings.push({
          rule: 'structural-shape',
          message: `${label(entry)} field '${k}' is a nested structure — every field in graph.yaml must be a scalar`,
        });
      }
    }
  }
  return findings;
}

export function checkStructuralShape(raw: any): Finding[] {
  return [
    ...checkShape(
      raw.epics || [],
      ['id', 'name', 'path'],
      ['id', 'name', 'path'],
      (e) => `epic '${e?.id ?? '(unknown id)'}'`
    ),
    ...checkShape(
      raw.nodes || [],
      ['id', 'type', 'path', 'epic'],
      ['id', 'type', 'path'],
      (n) => `node '${n?.id ?? '(unknown id)'}'`
    ),
    ...checkShape(
      raw.edges || [],
      ['from', 'type', 'to'],
      ['from', 'type', 'to'],
      (e) => `edge '${e?.from ?? '?'} --${e?.type ?? '?'}--> ${e?.to ?? '?'}'`
    ),
  ];
}

export function checkTypeLegality(raw: any): Finding[] {
  const findings: Finding[] = [];
  for (const node of raw.nodes || []) {
    if (!NODE_TYPES.includes(node.type)) {
      findings.push({ rule: 'type-legality', message: `node '${node.id}' has illegal type '${node.type}'` });
    }
  }
  for (const edge of raw.edges || []) {
    if (!EDGE_TYPES.includes(edge.type)) {
      findings.push({
        rule: 'type-legality',
        message: `edge from '${edge.from}' to '${edge.to}' has illegal type '${edge.type}'`,
      });
    }
  }
  return findings;
}

export function checkReferentialIntegrity(raw: any, specRoot: string): Finding[] {
  const findings: Finding[] = [];
  const epics = raw.epics || [];
  const nodes = raw.nodes || [];
  const edges = raw.edges || [];

  const allIds = [...epics.map((e: any) => e.id), ...nodes.map((n: any) => n.id)];
  const idSet = new Set(allIds);

  const seen = new Set<string>();
  for (const id of allIds) {
    if (id === undefined) continue;
    if (seen.has(id)) {
      findings.push({ rule: 'referential-integrity', message: `duplicate id '${id}'` });
    }
    seen.add(id);
  }

  for (const edge of edges) {
    if (!idSet.has(edge.from)) {
      findings.push({ rule: 'referential-integrity', message: `edge references unknown 'from' id '${edge.from}'` });
    }
    if (!idSet.has(edge.to)) {
      findings.push({ rule: 'referential-integrity', message: `edge references unknown 'to' id '${edge.to}'` });
    }
  }

  const epicIds = new Set(epics.map((e: any) => e.id));
  for (const node of nodes) {
    if (node.epic && !epicIds.has(node.epic)) {
      findings.push({ rule: 'referential-integrity', message: `node '${node.id}' references unknown epic '${node.epic}'` });
    }
  }

  for (const node of [...epics, ...nodes]) {
    if (node.path) {
      const fullPath = path.join(specRoot, node.path);
      if (!fs.existsSync(fullPath)) {
        findings.push({
          rule: 'referential-integrity',
          message: `node '${node.id}' path '${node.path}' does not exist`,
        });
      }
    }
  }

  const claimedPaths = new Set(
    [...epics, ...nodes].map((n: any) => path.normalize(n.path || ''))
  );
  const assetsDir = path.join(specRoot, 'assets');
  if (fs.existsSync(assetsDir)) {
    const walk = (dir: string): string[] => {
      let results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results = results.concat(walk(full));
        else if (entry.name.endsWith('.md')) results.push(full);
      }
      return results;
    };
    for (const file of walk(assetsDir)) {
      const relative = path.normalize(path.relative(specRoot, file));
      if (!claimedPaths.has(relative)) {
        findings.push({
          rule: 'referential-integrity',
          message: `file '${relative}' is not claimed by any node in graph.yaml`,
        });
      }
    }
  }

  return findings;
}

export function checkAssetContentPresence(raw: any, specRoot: string): Finding[] {
  const findings: Finding[] = [];
  for (const entry of [...(raw.epics || []), ...(raw.nodes || [])]) {
    if (!entry.path) continue;
    const fullPath = path.join(specRoot, entry.path);
    if (!fs.existsSync(fullPath)) continue; // already reported by checkReferentialIntegrity
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.trim().length === 0) {
      findings.push({
        rule: 'asset-content-presence',
        message: `node '${entry.id}' asset file '${entry.path}' is blank`,
      });
    }
  }
  return findings;
}

export function checkOverridesDirection(raw: any): Finding[] {
  const findings: Finding[] = [];
  const nodeTypeById = new Map<string, string>();
  for (const node of raw.nodes || []) {
    nodeTypeById.set(node.id, node.type);
  }
  for (const edge of raw.edges || []) {
    if (edge.type === 'overrides') {
      const fromType = nodeTypeById.get(edge.from);
      const toType = nodeTypeById.get(edge.to);
      if (fromType !== 'decision' || toType !== 'business_rule') {
        findings.push({
          rule: 'overrides-direction',
          message: `overrides edge from '${edge.from}' (${fromType ?? 'unknown'}) to '${edge.to}' (${
            toType ?? 'unknown'
          }) must be decision -> business_rule`,
        });
      }
    }
  }
  return findings;
}

export function checkSequentialNumbering(raw: any): Finding[] {
  const findings: Finding[] = [];
  const groups: Record<string, { label: string; pattern: RegExp; nodes: any[] }> = {
    business_rule: { label: 'BR', pattern: /^business_rule:BR-(\d{4})$/, nodes: [] },
    decision: { label: 'DC', pattern: /^decision:DC-(\d{4})$/, nodes: [] },
  };

  for (const node of raw.nodes || []) {
    if (groups[node.type]) groups[node.type].nodes.push(node);
  }

  for (const { label, pattern, nodes } of Object.values(groups)) {
    const numbers: number[] = [];
    for (const node of nodes) {
      const m = node.id.match(pattern);
      if (!m) {
        findings.push({
          rule: 'sequential-numbering',
          message: `id '${node.id}' does not match the required ${label}-NNNN format`,
        });
        continue;
      }
      numbers.push(parseInt(m[1], 10));
    }

    const seen = new Set<number>();
    for (const n of numbers) {
      if (seen.has(n)) {
        findings.push({ rule: 'sequential-numbering', message: `duplicate ${label} number ${n}` });
      }
      seen.add(n);
    }

    const maxNum = numbers.length ? Math.max(...numbers) : 0;
    for (let i = 1; i <= maxNum; i++) {
      if (!seen.has(i)) {
        findings.push({
          rule: 'sequential-numbering',
          message: `gap in ${label} sequence: missing ${label}-${String(i).padStart(4, '0')}`,
        });
      }
    }
  }

  return findings;
}

export function checkSkillFilesPresent(projectRoot: string, templatesSkillsDir: string): Finding[] {
  const findings: Finding[] = [];
  const skillsDir = path.join(projectRoot, 'traverspec', 'skills');
  const required = fs.existsSync(templatesSkillsDir) ? fs.readdirSync(templatesSkillsDir) : REQUIRED_SKILL_FILES;

  for (const file of required) {
    if (!fs.existsSync(path.join(skillsDir, file))) {
      findings.push({
        rule: 'skill-files-present',
        message: `required skill file 'traverspec/skills/${file}' is missing`,
      });
    }
  }
  return findings;
}
