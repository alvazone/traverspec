import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writeAgentsMd, getAgentsMdContent } from './agents';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeAgentsMd', () => {
  it('creates AGENTS.md with the marked block on first write', () => {
    const result = writeAgentsMd(tmpDir);
    expect(result).toBe('created');
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('<!-- traverspec:start -->');
    expect(content).toContain(getAgentsMdContent().trim());
  });

  it('is idempotent — reports unchanged on a repeat call with no drift', () => {
    writeAgentsMd(tmpDir);
    const second = writeAgentsMd(tmpDir);
    expect(second).toBe('unchanged');
  });

  it('preserves unrelated existing content in AGENTS.md', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# My Project\nReal notes.\n');
    const result = writeAgentsMd(tmpDir);
    expect(result).toBe('created');

    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Real notes.');
    expect(content).toContain('<!-- traverspec:start -->');
  });
});
