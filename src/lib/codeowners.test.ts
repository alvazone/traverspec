import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { addCodeowners } from './codeowners';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeowners-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('addCodeowners — github', () => {
  it('creates .github/CODEOWNERS when nothing exists (best-practice default location)', () => {
    const result = addCodeowners(tmpDir, 'github');
    expect(result.action).toBe('created');
    expect(result.filePath).toBe(path.join('.github', 'CODEOWNERS'));
    expect(fs.existsSync(path.join(tmpDir, '.github', 'CODEOWNERS'))).toBe(true);
  });

  it('prefers an existing .github/CODEOWNERS over a root one (matches GitHub precedence)', () => {
    fs.writeFileSync(path.join(tmpDir, 'CODEOWNERS'), '# root file, should be ignored\n');
    fs.mkdirSync(path.join(tmpDir, '.github'));
    fs.writeFileSync(path.join(tmpDir, '.github', 'CODEOWNERS'), '# real one\n');

    const result = addCodeowners(tmpDir, 'github');
    expect(result.filePath).toBe(path.join('.github', 'CODEOWNERS'));

    const rootContent = fs.readFileSync(path.join(tmpDir, 'CODEOWNERS'), 'utf8');
    expect(rootContent).toBe('# root file, should be ignored\n'); // untouched
  });

  it('appends to an existing root CODEOWNERS if .github/CODEOWNERS does not exist', () => {
    fs.writeFileSync(path.join(tmpDir, 'CODEOWNERS'), '*.tf @infra-team\n');
    const result = addCodeowners(tmpDir, 'github');
    expect(result.filePath).toBe('CODEOWNERS');
    const content = fs.readFileSync(path.join(tmpDir, 'CODEOWNERS'), 'utf8');
    expect(content).toContain('*.tf @infra-team');
    expect(content).toContain('/traverspec/skills/ @CHANGE_ME');
  });

  it('every non-blank line in the injected block is a valid CODEOWNERS comment or rule', () => {
    addCodeowners(tmpDir, 'github');
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'CODEOWNERS'), 'utf8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      const isComment = line.trimStart().startsWith('#');
      const isRule = /^\/\S+\s+@\S+/.test(line);
      expect(isComment || isRule).toBe(true);
    }
  });

  it('is idempotent on repeat runs', () => {
    addCodeowners(tmpDir, 'github');
    const second = addCodeowners(tmpDir, 'github');
    expect(second.action).toBe('unchanged');
  });
});

describe('addCodeowners — gitlab', () => {
  it('creates root CODEOWNERS when nothing exists', () => {
    const result = addCodeowners(tmpDir, 'gitlab');
    expect(result.filePath).toBe('CODEOWNERS');
    expect(fs.existsSync(path.join(tmpDir, 'CODEOWNERS'))).toBe(true);
  });

  it('prefers an existing root CODEOWNERS over .gitlab/CODEOWNERS (matches GitLab precedence)', () => {
    fs.writeFileSync(path.join(tmpDir, 'CODEOWNERS'), '# real one\n');
    fs.mkdirSync(path.join(tmpDir, '.gitlab'));
    fs.writeFileSync(path.join(tmpDir, '.gitlab', 'CODEOWNERS'), '# should be ignored\n');

    const result = addCodeowners(tmpDir, 'gitlab');
    expect(result.filePath).toBe('CODEOWNERS');

    const gitlabDirContent = fs.readFileSync(path.join(tmpDir, '.gitlab', 'CODEOWNERS'), 'utf8');
    expect(gitlabDirContent).toBe('# should be ignored\n'); // untouched
  });
});
