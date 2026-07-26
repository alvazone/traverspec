import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildRemovalPlan, executeRemovalPlan } from './remove';
import { writeAgentsMd } from './agents';
import { initCommand } from '../commands/init';
import { addAgentCommand } from '../commands/addAgent';
import { addCodeowners } from './codeowners';
import { addHooks } from './hooks';

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

  it('plans and removes a full init + add-agent claude setup cleanly', () => {
    initCommand();
    addAgentCommand('claude');

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
    writeAgentsMd(tmpDir);

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

  it('removes traverspec skill folders but leaves .agents/skills/ and .agents/ themselves in place, even empty', () => {
    initCommand();
    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'traverspec-read'))).toBe(true);

    const plan = buildRemovalPlan(tmpDir);
    const skillActions = plan.filter((a) => a.relPath.startsWith(path.join('.agents', 'skills')));
    expect(skillActions.length).toBeGreaterThan(0);
    expect(skillActions.every((a) => a.kind === 'delete-folder')).toBe(true);

    executeRemovalPlan(tmpDir, plan);

    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'traverspec-read'))).toBe(false);
    // .agents/skills/ and .agents/ are shared locations, not traverspec's to delete
    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.agents'))).toBe(true);
    expect(fs.readdirSync(path.join(tmpDir, '.agents', 'skills'))).toEqual([]);
  });

  it('does not touch another tool\'s own skill folder sitting alongside traverspec\'s in .agents/skills/', () => {
    initCommand();
    fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', 'some-other-skill'), { recursive: true });

    executeRemovalPlan(tmpDir, buildRemovalPlan(tmpDir));

    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'some-other-skill'))).toBe(true);
  });

  it('removes cursor and claude hooks (config entries, scripts, and state) via a plain remove', () => {
    initCommand();
    addHooks(tmpDir, 'cursor', () => true);
    addHooks(tmpDir, 'claude', () => true);

    const plan = buildRemovalPlan(tmpDir);
    expect(plan.some((a) => a.kind === 'remove-hooks' && a.hookTool === 'cursor')).toBe(true);
    expect(plan.some((a) => a.kind === 'remove-hooks' && a.hookTool === 'claude')).toBe(true);

    executeRemovalPlan(tmpDir, plan);

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'traverspec-hooks'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'track-touched-files.sh'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'check-reconciliation.sh'))).toBe(false);
    // .claude/ itself is shared and stays, even if hooks/ ends up empty
    expect(fs.existsSync(path.join(tmpDir, '.claude'))).toBe(true);

    const settings = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8'));
    expect(settings.hooks).toEqual({});
  });

  it('isolates a per-action failure — earlier actions still succeed, later ones are still attempted, nothing crashes', () => {
    initCommand();
    addAgentCommand('claude');
    fs.appendFileSync(path.join(tmpDir, 'AGENTS.md'), '# unrelated notes\n'); // forces strip-block (write), not delete-file (unlink)

    const plan = buildRemovalPlan(tmpDir);
    fs.chmodSync(path.join(tmpDir, 'AGENTS.md'), 0o444); // simulate something changing during the confirmation pause

    let outcomes;
    expect(() => {
      outcomes = executeRemovalPlan(tmpDir, plan);
    }).not.toThrow();

    const agentsOutcome = outcomes!.find((o) => o.action.relPath === 'AGENTS.md');
    expect(agentsOutcome?.ok).toBe(false);
    expect(agentsOutcome?.error).toContain('permission denied');

    // Actions before AND after the failed one in iteration order still completed.
    expect(fs.existsSync(path.join(tmpDir, 'traverspec'))).toBe(false); // before, in the array
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false); // after, in the array

    fs.chmodSync(path.join(tmpDir, 'AGENTS.md'), 0o644);
  });

  it('reports a failed hooks removal instead of silently discarding it', () => {
    initCommand();
    addHooks(tmpDir, 'claude', () => true);

    const plan = buildRemovalPlan(tmpDir);

    // Simulate the same confirmation-pause race for hooks specifically.
    fs.rmSync(path.join(tmpDir, '.claude'), { recursive: true, force: true });
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-outside-'));
    fs.symlinkSync(outsideDir, path.join(tmpDir, '.claude'));

    const outcomes = executeRemovalPlan(tmpDir, plan);
    const hooksOutcome = outcomes.find((o) => o.action.kind === 'remove-hooks' && o.action.hookTool === 'claude');
    expect(hooksOutcome?.ok).toBe(false);
    expect(hooksOutcome?.error).toContain('resolves outside the project');

    fs.rmSync(path.join(tmpDir, '.claude'), { force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('refuses to touch AGENTS.md through a symlink escaping the project, and leaves the outside file untouched', () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-outside-'));
    const victim = path.join(outsideDir, 'victim.md');
    fs.writeFileSync(victim, 'UNRELATED BEFORE\n<!-- traverspec:start -->\ncontent\n<!-- traverspec:end -->\nUNRELATED AFTER\n');
    fs.symlinkSync(victim, path.join(tmpDir, 'AGENTS.md'));

    const plan = buildRemovalPlan(tmpDir);
    expect(plan.find((a) => a.relPath === 'AGENTS.md')).toBeUndefined();

    executeRemovalPlan(tmpDir, plan);
    expect(fs.readFileSync(victim, 'utf8')).toContain('UNRELATED BEFORE');
    expect(fs.readFileSync(victim, 'utf8')).toContain('traverspec:start'); // untouched entirely

    fs.rmSync(outsideDir, { recursive: true, force: true });
  });
});
