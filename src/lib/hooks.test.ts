import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { addHooks, removeHooks, checkJqAvailable } from './hooks';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-test-'));
  fs.mkdirSync(path.join(tmpDir, 'traverspec'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const jqAvailable = () => true;
const jqMissing = () => false;

describe('checkJqAvailable', () => {
  it('returns a boolean without throwing', () => {
    expect(typeof checkJqAvailable()).toBe('boolean');
  });
});

describe('addHooks — preconditions', () => {
  it('refuses when there is no traverspec/ folder', () => {
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-bare-'));
    const result = addHooks(bareDir, 'cursor', jqAvailable);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('traverspec init');
    fs.rmSync(bareDir, { recursive: true, force: true });
  });

  it('refuses when jq is not available, and writes nothing', () => {
    const result = addHooks(tmpDir, 'cursor', jqMissing);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('jq');
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'hooks.json'))).toBe(false);
  });
});

describe('addHooks — cursor', () => {
  it('creates hooks.json and both scripts on a fresh project', () => {
    const result = addHooks(tmpDir, 'cursor', jqAvailable);
    expect(result.ok).toBe(true);

    const hooksJsonPath = path.join(tmpDir, '.cursor', 'hooks.json');
    expect(fs.existsSync(hooksJsonPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
    expect(parsed.hooks.afterFileEdit[0].command).toBe('.cursor/traverspec-hooks/track-edit.sh');
    expect(parsed.hooks.stop[0].command).toBe('.cursor/traverspec-hooks/remind-reconcile.sh');

    const trackScript = path.join(tmpDir, '.cursor', 'traverspec-hooks', 'track-edit.sh');
    const remindScript = path.join(tmpDir, '.cursor', 'traverspec-hooks', 'remind-reconcile.sh');
    expect(fs.existsSync(trackScript)).toBe(true);
    expect(fs.existsSync(remindScript)).toBe(true);
    // executable bit set
    expect(fs.statSync(trackScript).mode & 0o111).not.toBe(0);
  });

  it('is idempotent — running twice does not duplicate hook entries', () => {
    addHooks(tmpDir, 'cursor', jqAvailable);
    const second = addHooks(tmpDir, 'cursor', jqAvailable);

    expect(second.skipped.some((s) => s.includes('afterFileEdit'))).toBe(true);
    expect(second.skipped.some((s) => s.includes('stop'))).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), 'utf8'));
    expect(parsed.hooks.afterFileEdit.length).toBe(1);
    expect(parsed.hooks.stop.length).toBe(1);
  });

  it('merges alongside existing, unrelated hooks without touching them', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.cursor', 'hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          afterFileEdit: [{ command: './scripts/run-prettier.sh', type: 'command' }],
          beforeShellExecution: [{ command: './scripts/audit-shell.sh', type: 'command' }],
        },
      })
    );

    addHooks(tmpDir, 'cursor', jqAvailable);

    const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), 'utf8'));
    const afterFileEditCommands = parsed.hooks.afterFileEdit.map((h: any) => h.command);
    expect(afterFileEditCommands).toContain('./scripts/run-prettier.sh');
    expect(afterFileEditCommands).toContain('.cursor/traverspec-hooks/track-edit.sh');
    expect(parsed.hooks.beforeShellExecution[0].command).toBe('./scripts/audit-shell.sh');
  });

  it('refuses and leaves the file untouched if hooks.json is not valid JSON', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), '{ not valid json');

    const result = addHooks(tmpDir, 'cursor', jqAvailable);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('valid JSON');
    expect(fs.readFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), 'utf8')).toBe('{ not valid json');
  });
});

describe('addHooks — claude', () => {
  it('creates settings.json and both scripts on a fresh project', () => {
    const result = addHooks(tmpDir, 'claude', jqAvailable);
    expect(result.ok).toBe(true);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(parsed.hooks.PostToolUse[0].hooks[0].command).toBe(
      '$CLAUDE_PROJECT_DIR/.claude/hooks/track-touched-files.sh'
    );
    expect(parsed.hooks.Stop[0].hooks[0].command).toBe(
      '$CLAUDE_PROJECT_DIR/.claude/hooks/check-reconciliation.sh'
    );

    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'track-touched-files.sh'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'check-reconciliation.sh'))).toBe(true);
  });

  it('merges alongside an existing, unrelated PostToolUse matcher block', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './scripts/log-bash.sh' }] }],
        },
      })
    );

    addHooks(tmpDir, 'claude', jqAvailable);

    const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8'));
    expect(parsed.hooks.PostToolUse).toHaveLength(2);
    const bashBlock = parsed.hooks.PostToolUse.find((b: any) => b.matcher === 'Bash');
    expect(bashBlock.hooks[0].command).toBe('./scripts/log-bash.sh');
  });
});

describe('removeHooks', () => {
  it('reports nothing to remove when no config file exists', () => {
    const result = removeHooks(tmpDir, 'cursor');
    expect(result.ok).toBe(true);
    expect(result.removed).toEqual([]);
  });

  it('removes only our entries for cursor, preserving unrelated hooks and dropping empty keys', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.cursor', 'hooks.json'),
      JSON.stringify({
        version: 1,
        hooks: {
          afterFileEdit: [{ command: './scripts/run-prettier.sh', type: 'command' }],
          beforeShellExecution: [{ command: './scripts/audit-shell.sh', type: 'command' }],
        },
      })
    );
    addHooks(tmpDir, 'cursor', jqAvailable);

    const result = removeHooks(tmpDir, 'cursor');
    expect(result.ok).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), 'utf8'));
    expect(parsed.hooks.afterFileEdit).toEqual([{ command: './scripts/run-prettier.sh', type: 'command' }]);
    expect(parsed.hooks.beforeShellExecution[0].command).toBe('./scripts/audit-shell.sh');
    expect(parsed.hooks.stop).toBeUndefined(); // only had our entry, key dropped entirely

    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'traverspec-hooks'))).toBe(false);
  });

  it('removes only our entries for claude, preserving the unrelated matcher block', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './scripts/log-bash.sh' }] }],
        },
      })
    );
    addHooks(tmpDir, 'claude', jqAvailable);

    removeHooks(tmpDir, 'claude');

    const parsed = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude', 'settings.json'), 'utf8'));
    expect(parsed.hooks.PostToolUse).toHaveLength(1);
    expect(parsed.hooks.PostToolUse[0].matcher).toBe('Bash');
    expect(parsed.hooks.Stop).toBeUndefined();

    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'track-touched-files.sh'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'check-reconciliation.sh'))).toBe(false);
  });

  it('cleans up leftover per-session state files', () => {
    addHooks(tmpDir, 'claude', jqAvailable);
    fs.writeFileSync(path.join(tmpDir, '.claude', 'hooks', 'state-abc123.json'), '{"touched_files":[]}');

    removeHooks(tmpDir, 'claude');

    expect(fs.existsSync(path.join(tmpDir, '.claude', 'hooks', 'state-abc123.json'))).toBe(false);
  });

  it('refuses and leaves the file untouched if the config is not valid JSON', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), '{ not valid json');

    const result = removeHooks(tmpDir, 'cursor');
    expect(result.ok).toBe(false);
    expect(fs.readFileSync(path.join(tmpDir, '.cursor', 'hooks.json'), 'utf8')).toBe('{ not valid json');
  });
});
