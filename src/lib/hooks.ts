import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { assertPathContained } from './pathSafety';

export type HookTool = 'cursor' | 'claude';
export const KNOWN_HOOK_TOOLS: HookTool[] = ['cursor', 'claude'];

const TEMPLATES_HOOKS_DIR = path.join(__dirname, '..', '..', 'templates', 'hooks');

// The state-file prefix TraverSpec's own Claude Code hook scripts use inside
// the shared .claude/hooks/ directory. Namespaced specifically to this tool
// (not just "state-") because that directory isn't exclusively ours — other
// tools' hooks can live there too, and cleanup needs to be able to tell its
// own files apart from theirs without guessing.
export const CLAUDE_STATE_FILE_PREFIX = 'traverspec-state-';

interface HookScriptSpec {
  templateFile: string;
  destRelative: string;
  /** The exact command string this tool's hook config references the script by. */
  command: string;
  event: string;
  /** Claude Code's PostToolUse/Stop blocks are matcher-scoped; Cursor's aren't. */
  matcher?: string;
}

interface ToolHookConfig {
  configRelativePath: string;
  scripts: HookScriptSpec[];
}

const CURSOR_CONFIG: ToolHookConfig = {
  configRelativePath: path.join('.cursor', 'hooks.json'),
  scripts: [
    {
      templateFile: 'cursor/track-edit.sh',
      destRelative: path.join('.cursor', 'traverspec-hooks', 'track-edit.sh'),
      command: '.cursor/traverspec-hooks/track-edit.sh',
      event: 'afterFileEdit',
    },
    {
      templateFile: 'cursor/remind-reconcile.sh',
      destRelative: path.join('.cursor', 'traverspec-hooks', 'remind-reconcile.sh'),
      command: '.cursor/traverspec-hooks/remind-reconcile.sh',
      event: 'stop',
    },
  ],
};

const CLAUDE_CONFIG: ToolHookConfig = {
  configRelativePath: path.join('.claude', 'settings.json'),
  scripts: [
    {
      templateFile: 'claude/track-touched-files.sh',
      destRelative: path.join('.claude', 'hooks', 'track-touched-files.sh'),
      command: '$CLAUDE_PROJECT_DIR/.claude/hooks/track-touched-files.sh',
      event: 'PostToolUse',
      matcher: 'Write|Edit',
    },
    {
      templateFile: 'claude/check-reconciliation.sh',
      destRelative: path.join('.claude', 'hooks', 'check-reconciliation.sh'),
      command: '$CLAUDE_PROJECT_DIR/.claude/hooks/check-reconciliation.sh',
      event: 'Stop',
      matcher: '',
    },
  ],
};

function configFor(tool: HookTool): ToolHookConfig {
  return tool === 'cursor' ? CURSOR_CONFIG : CLAUDE_CONFIG;
}

/** The hook config file's project-relative path for a tool, without duplicating it elsewhere. */
export function hookConfigPath(tool: HookTool): string {
  return configFor(tool).configRelativePath;
}

/**
 * A read or write failure on the hook config file that isn't itself a JSON
 * problem — e.g. permission denied, or the path exists as a directory. Kept
 * distinct from "isn't valid JSON" so the reported reason actually matches
 * what went wrong instead of always blaming JSON validity.
 */
function fileAccessErrorReason(relPath: string, err: any): string {
  if (err.code === 'EACCES' || err.code === 'EPERM') {
    return `${relPath} exists but isn't readable/writable (permission denied). Fix permissions, then run this again.`;
  }
  if (err.code === 'EISDIR') {
    return `${relPath} exists as a directory, not a file. Remove or rename it, then run this again.`;
  }
  return `couldn't access ${relPath} — ${err.message}. Run this again, or fix/remove it manually.`;
}

export function checkJqAvailable(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export interface AddHooksResult {
  ok: boolean;
  reason?: string;
  created: string[];
  skipped: string[];
}

/**
 * Merges TraverSpec's own hook entries into whatever hooks.json already
 * exists — never overwrites the file, since both Cursor and Claude Code's
 * hook schemas are explicitly designed to hold multiple independent hooks
 * per event. Only refuses outright if the existing file can't be parsed.
 */
export function addHooks(
  root: string,
  tool: HookTool,
  jqCheck: () => boolean = checkJqAvailable
): AddHooksResult {
  if (!fs.existsSync(path.join(root, 'traverspec'))) {
    return {
      ok: false,
      reason: 'No traverspec/ folder found in this project — run `traverspec init` first.',
      created: [],
      skipped: [],
    };
  }

  if (!jqCheck()) {
    return {
      ok: false,
      reason:
        'jq is required for these hooks but was not found on this machine. Install it first — ' +
        '`brew install jq` on macOS, `sudo apt install jq` on Debian/Ubuntu — then run this again.',
      created: [],
      skipped: [],
    };
  }

  const config = configFor(tool);

  // A symlinked config path or hook-script destination (planted by a
  // malicious repo, e.g. .claude -> somewhere outside the project) would
  // otherwise let this write and chmod +x an executable script wherever
  // that symlink points, fully wired up via the config file written
  // alongside it. Check every path this function is about to touch before
  // touching any of them.
  try {
    assertPathContained(root, config.configRelativePath);
    for (const script of config.scripts) {
      assertPathContained(root, script.destRelative);
    }
  } catch (err: any) {
    return { ok: false, reason: err.message, created: [], skipped: [] };
  }

  const configPath = path.join(root, config.configRelativePath);

  let parsed: any = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    if (raw.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch (err: any) {
        return {
          ok: false,
          reason: `${config.configRelativePath} exists but isn't valid JSON (${err.message}). Fix or remove it, then run this again.`,
          created: [],
          skipped: [],
        };
      }
    }
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const merged = tool === 'cursor' ? mergeCursorHooks(config, parsed, created, skipped) : mergeClaudeHooks(config, parsed, created, skipped);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n');
  created.push(config.configRelativePath);

  for (const script of config.scripts) {
    const destPath = path.join(root, script.destRelative);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(path.join(TEMPLATES_HOOKS_DIR, script.templateFile), destPath);
    fs.chmodSync(destPath, 0o755);
    created.push(script.destRelative);
  }

  return { ok: true, created, skipped };
}

function mergeCursorHooks(config: ToolHookConfig, parsed: any, created: string[], skipped: string[]): any {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) parsed = {};
  if (typeof parsed.version !== 'number') parsed.version = 1;
  if (typeof parsed.hooks !== 'object' || parsed.hooks === null) parsed.hooks = {};

  for (const { event, command } of config.scripts) {
    if (!Array.isArray(parsed.hooks[event])) parsed.hooks[event] = [];
    const already = parsed.hooks[event].some((h: any) => h && h.command === command);
    if (already) {
      skipped.push(`${event} hook (already present)`);
    } else {
      parsed.hooks[event].push({ command, type: 'command' });
      created.push(`${event} hook entry`);
    }
  }

  return parsed;
}

function mergeClaudeHooks(config: ToolHookConfig, parsed: any, created: string[], skipped: string[]): any {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) parsed = {};
  if (typeof parsed.hooks !== 'object' || parsed.hooks === null) parsed.hooks = {};

  for (const { event, matcher, command } of config.scripts) {
    if (!Array.isArray(parsed.hooks[event])) parsed.hooks[event] = [];
    const already = parsed.hooks[event].some(
      (block: any) => Array.isArray(block?.hooks) && block.hooks.some((h: any) => h && h.command === command)
    );
    if (already) {
      skipped.push(`${event} hook (already present)`);
    } else {
      parsed.hooks[event].push({ matcher, hooks: [{ type: 'command', command, timeout: 10 }] });
      created.push(`${event} hook entry`);
    }
  }

  return parsed;
}

export interface RemoveHooksResult {
  ok: boolean;
  reason?: string;
  removed: string[];
}

/**
 * Removes only the hook entries TraverSpec itself added, identified by their
 * distinctive script command paths — leaves any other hooks in the same
 * file completely untouched, and drops an event key entirely once it has
 * no entries left rather than leaving an empty array behind.
 *
 * With `dryRun: true`, computes and returns exactly what would be removed
 * without writing, deleting, or cleaning up anything — used by `remove` to
 * build an accurate preview before asking for confirmation.
 */
export function removeHooks(root: string, tool: HookTool, options: { dryRun?: boolean } = {}): RemoveHooksResult {
  const config = configFor(tool);

  // Same symlink-escape risk as addHooks — a symlinked config path or
  // script destination could redirect this into modifying or deleting a
  // file entirely outside the project. Check before touching anything.
  try {
    assertPathContained(root, config.configRelativePath);
    for (const script of config.scripts) {
      assertPathContained(root, script.destRelative);
    }
  } catch (err: any) {
    return { ok: false, reason: err.message, removed: [] };
  }

  const configPath = path.join(root, config.configRelativePath);
  const removed: string[] = [];

  if (fs.existsSync(configPath)) {
    let raw: string;
    try {
      raw = fs.readFileSync(configPath, 'utf8');
    } catch (err: any) {
      return { ok: false, reason: fileAccessErrorReason(config.configRelativePath, err), removed: [] };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      return {
        ok: false,
        reason: `${config.configRelativePath} isn't valid JSON (${err.message}) — left untouched. Fix or remove it manually.`,
        removed: [],
      };
    }

    if (parsed?.hooks && typeof parsed.hooks === 'object') {
      if (tool === 'cursor') removeCursorEntries(config, parsed.hooks, removed);
      else removeClaudeEntries(config, parsed.hooks, removed);
    }

    if (!options.dryRun) {
      try {
        fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n');
      } catch (err: any) {
        return { ok: false, reason: fileAccessErrorReason(config.configRelativePath, err), removed: [] };
      }
    }
  }

  for (const script of config.scripts) {
    const destPath = path.join(root, script.destRelative);
    if (fs.existsSync(destPath)) {
      if (!options.dryRun) fs.unlinkSync(destPath);
      removed.push(script.destRelative);
    }
  }

  if (!options.dryRun) cleanupState(root, tool);

  return { ok: true, removed };
}

function removeCursorEntries(config: ToolHookConfig, hooks: any, removed: string[]): void {
  const ourCommands = config.scripts.map((s) => s.command);
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    const before = hooks[event].length;
    hooks[event] = hooks[event].filter((h: any) => !ourCommands.includes(h?.command));
    if (hooks[event].length !== before) removed.push(`${event} hook entry`);
    if (hooks[event].length === 0) delete hooks[event];
  }
}

function removeClaudeEntries(config: ToolHookConfig, hooks: any, removed: string[]): void {
  const ourCommands = config.scripts.map((s) => s.command);
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    hooks[event] = hooks[event]
      .map((block: any) => {
        if (!Array.isArray(block?.hooks)) return block;
        const before = block.hooks.length;
        block.hooks = block.hooks.filter((h: any) => !ourCommands.includes(h?.command));
        if (block.hooks.length !== before) removed.push(`${event} hook entry`);
        return block;
      })
      .filter((block: any) => Array.isArray(block?.hooks) && block.hooks.length > 0);
    if (hooks[event].length === 0) delete hooks[event];
  }
}

function cleanupState(root: string, tool: HookTool): void {
  if (tool === 'cursor') {
    // .cursor/traverspec-hooks/ is a dedicated subfolder this tool owns
    // exclusively, so it's safe to remove wholesale once empty.
    const hooksDir = path.join(root, '.cursor', 'traverspec-hooks');
    const stateDir = path.join(hooksDir, 'state');
    if (fs.existsSync(stateDir)) fs.rmSync(stateDir, { recursive: true, force: true });
    if (fs.existsSync(hooksDir) && fs.readdirSync(hooksDir).length === 0) fs.rmdirSync(hooksDir);
  } else {
    // .claude/hooks/ is shared with any other tool's own hooks, so cleanup
    // here can only ever touch files unambiguously namespaced as ours —
    // never the directory itself, and never a bare "state-" prefix that
    // some other tool's own state file could just as easily match.
    const claudeHooksDir = path.join(root, '.claude', 'hooks');
    if (fs.existsSync(claudeHooksDir)) {
      for (const f of fs.readdirSync(claudeHooksDir)) {
        if (f.startsWith(CLAUDE_STATE_FILE_PREFIX)) fs.unlinkSync(path.join(claudeHooksDir, f));
      }
    }
  }
}
