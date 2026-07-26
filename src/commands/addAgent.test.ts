import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { addAgentCommand } from './addAgent';
import { initCommand } from './init';

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-agent-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('addAgentCommand', () => {
  it('requires traverspec/ to already exist', () => {
    addAgentCommand();
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(false);
    process.exitCode = 0;
  });

  it('rejects an unsupported parameter without touching anything', () => {
    initCommand();
    addAgentCommand('cursor');
    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
    const skillsBefore = fs.readdirSync(path.join(tmpDir, '.agents', 'skills'));
    expect(skillsBefore.length).toBeGreaterThan(0); // untouched by the rejected call, not emptied
    process.exitCode = 0;
  });

  it('bare add-agent writes AGENTS.md and .agents/skills/, not CLAUDE.md or .claude/skills/', () => {
    initCommand();
    fs.rmSync(path.join(tmpDir, '.agents'), { recursive: true, force: true });

    addAgentCommand();

    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'traverspec-read'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude'))).toBe(false);
  });

  it('add-agent claude writes CLAUDE.md and .claude/skills/ only — not AGENTS.md or .agents/skills/', () => {
    initCommand();
    fs.rmSync(path.join(tmpDir, 'AGENTS.md'), { force: true });
    fs.rmSync(path.join(tmpDir, '.agents'), { recursive: true, force: true });

    addAgentCommand('claude');

    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'traverspec-read'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.agents'))).toBe(false);
  });

  it('is case-insensitive and tolerant of surrounding whitespace for claude', () => {
    initCommand();
    addAgentCommand('  Claude  ');
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
  });
});
