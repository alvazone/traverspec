import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { upsertMarkedBlock, removeMarkedBlock, HTML_COMMENT_MARKERS } from './markerBlock';

let tmpDir: string;
let filePath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markerblock-test-'));
  filePath = path.join(tmpDir, 'AGENTS.md');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('removeMarkedBlock', () => {
  it('returns not-found and does nothing if the file does not exist', () => {
    expect(removeMarkedBlock(filePath)).toBe('not-found');
  });

  it('returns not-found and does nothing if the file exists but has no marked block', () => {
    fs.writeFileSync(filePath, '# Unrelated content\n');
    expect(removeMarkedBlock(filePath)).toBe('not-found');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('# Unrelated content\n');
  });

  it('deletes the whole file when the marked block is all there is', () => {
    upsertMarkedBlock(filePath, 'pointer content');
    expect(removeMarkedBlock(filePath)).toBe('file-deleted');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('strips only the block and preserves surrounding content otherwise', () => {
    fs.writeFileSync(filePath, '# My Project\nReal notes here.\n');
    upsertMarkedBlock(filePath, 'pointer content');

    const result = removeMarkedBlock(filePath);
    expect(result).toBe('block-stripped');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Real notes here.');
    expect(content).not.toContain('traverspec:start');
  });

  it('dry run reports the outcome without changing anything', () => {
    upsertMarkedBlock(filePath, 'pointer content');
    const before = fs.readFileSync(filePath, 'utf8');

    const result = removeMarkedBlock(filePath, HTML_COMMENT_MARKERS, { dryRun: true });

    expect(result).toBe('file-deleted');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
  });
});
