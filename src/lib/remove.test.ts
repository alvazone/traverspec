import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildRemovalPlan, executeRemovalPlan } from './remove';
import { applyAgents } from './agents';
import { initCommand } from '../commands/init';
import { addCodeowners } from './codeowners';

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildRemovalPlan / executeRemovalPlan', () => {
  it('reports nothing to remove on an empty directory', () => {
    expect(buildRemovalPlan(tmpDir)).toEqual([]);
  });

  it('plans and removes a full init --agent claude setup cleanly', () => {
    initCommand({ agent: 'claude' });

    const plan = buildRemovalPlan(tmpDir);
    const targets = plan.map((a) => a.relPath);
    expect(targets).toContain('traverspec');
    expect(targets).toContain('AGENTS.md');
    expect(targets).toContain('CLAUDE.md');
    expect(plan.every((a) => a.kind === 'delete-folder' || a.kind === 'delete-file')).toBe(true);

    executeRemovalPlan(tmpDir, plan);

    expect(fs.existsSync(path.join(tmpDir, 'traverspec'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('strips (not deletes) AGENTS.md when it has unrelated content, and leaves that content intact', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# My Project\nBuild with npm run dev.\n');
    applyAgents(tmpDir, ['claude']);

    const plan = buildRemovalPlan(tmpDir);
    const agentsAction = plan.find((a) => a.relPath === 'AGENTS.md');
    expect(agentsAction?.kind).toBe('strip-block');

    executeRemovalPlan(tmpDir, plan);

    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('Build with npm run dev.');
    expect(content).not.toContain('traverspec:start');
  });

  it('finds and removes a CODEOWNERS entry regardless of which of the 4 locations it landed in', () => {
    fs.mkdirSync(path.join(tmpDir, '.github'), { recursive: true });
    addCodeowners(tmpDir, 'github');

    const plan = buildRemovalPlan(tmpDir);
    const codeownersAction = plan.find((a) => a.relPath === '.github/CODEOWNERS');
    expect(codeownersAction).toBeDefined();

    executeRemovalPlan(tmpDir, plan);
    expect(fs.existsSync(path.join(tmpDir, '.github/CODEOWNERS'))).toBe(false);
  });
});
