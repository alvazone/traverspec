import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { checkReferentialIntegrity, checkSkillFilesPresent } from './rules';

const FIXTURES_ROOT = path.join(__dirname, '..', '..', 'test-fixtures');

function loadFixtureGraph(name: string): { raw: any; specRoot: string } {
  const specRoot = path.join(FIXTURES_ROOT, name, 'traverspec');
  const raw = yaml.load(fs.readFileSync(path.join(specRoot, 'graph.yaml'), 'utf8'));
  return { raw, specRoot };
}

describe('checkReferentialIntegrity against real fixture projects', () => {
  it('valid-project has no referential integrity issues', () => {
    const { raw, specRoot } = loadFixtureGraph('valid-project');
    expect(checkReferentialIntegrity(raw, specRoot)).toEqual([]);
  });

  it('does not flag an epic asset file as orphaned (epics claim paths too, not just nodes)', () => {
    const { raw, specRoot } = loadFixtureGraph('valid-project');
    const findings = checkReferentialIntegrity(raw, specRoot);
    expect(findings.some((f) => f.message.includes('billing.md'))).toBe(false);
  });

  it('orphan-file-project flags the file no node claims', () => {
    const { raw, specRoot } = loadFixtureGraph('orphan-file-project');
    const findings = checkReferentialIntegrity(raw, specRoot);
    expect(findings.some((f) => f.message.includes('orphan-not-in-graph.md'))).toBe(true);
  });

  it('flags a dangling edge reference', () => {
    const { specRoot } = loadFixtureGraph('valid-project');
    const raw = {
      epics: [],
      nodes: [{ id: 'feature:checkout', type: 'feature', path: 'assets/feature/checkout.md' }],
      edges: [{ from: 'feature:checkout', type: 'mutates', to: 'data_model:DoesNotExist' }],
    };
    const findings = checkReferentialIntegrity(raw, specRoot);
    expect(findings.some((f) => f.message.includes("unknown 'to' id 'data_model:DoesNotExist'"))).toBe(true);
  });

  it('flags a node whose path does not exist on disk', () => {
    const { specRoot } = loadFixtureGraph('valid-project');
    const raw = {
      epics: [],
      nodes: [{ id: 'feature:ghost', type: 'feature', path: 'assets/feature/ghost.md' }],
      edges: [],
    };
    const findings = checkReferentialIntegrity(raw, specRoot);
    expect(findings.some((f) => f.message.includes("path 'assets/feature/ghost.md' does not exist"))).toBe(true);
  });
});

describe('checkSkillFilesPresent against real fixture projects', () => {
  const templatesSkillsDir = path.join(__dirname, '..', '..', 'templates', 'skills');

  it('valid-project has all required skill files', () => {
    const projectRoot = path.join(FIXTURES_ROOT, 'valid-project');
    expect(checkSkillFilesPresent(projectRoot, templatesSkillsDir)).toEqual([]);
  });

  it('missing-skill-file-project flags the missing file', () => {
    const projectRoot = path.join(FIXTURES_ROOT, 'missing-skill-file-project');
    const findings = checkSkillFilesPresent(projectRoot, templatesSkillsDir);
    expect(findings.some((f) => f.message.includes('derive_spec_from_code.md'))).toBe(true);
  });
});
