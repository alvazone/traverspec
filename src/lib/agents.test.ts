import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applyAgents } from './agents';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('applyAgents', () => {
  it('always writes AGENTS.md, even with an empty request list', () => {
    const result = applyAgents(tmpDir, []);
    expect(result.created).toContain('AGENTS.md');
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('writes CLAUDE.md only when claude is requested', () => {
    const result = applyAgents(tmpDir, ['cursor']);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);

    const result2 = applyAgents(tmpDir, ['claude']);
    expect(result2.created).toContain('CLAUDE.md');
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8')).toContain('@AGENTS.md');
  });

  it('flags unrecognized agent names without touching anything for them', () => {
    const result = applyAgents(tmpDir, ['kiro']);
    expect(result.unknown).toEqual(['kiro']);
    expect(fs.existsSync(path.join(tmpDir, 'KIRO.md'))).toBe(false);
  });

  it('is idempotent and preserves unrelated existing content', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# My Project\nReal notes.\n');
    applyAgents(tmpDir, ['claude']);
    const second = applyAgents(tmpDir, ['claude']);

    expect(second.skipped.some((s) => s.includes('AGENTS.md'))).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Real notes.');
  });
});
