import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export type HookTool = 'cursor' | 'claude';
export const KNOWN_HOOK_TOOLS: HookTool[] = ['cursor', 'claude'];

const TEMPLATES_HOOKS_DIR = path.join(__dirname, '..', '..', 'templates', 'hooks');

interface HookScriptSpec {
  templateFile: string;
  destRelative: string;
}

interface ToolHookConfig {
  configRelativePath: string;
  scripts: HookScriptSpec[];
}

const CURSOR_CONFIG: ToolHookConfig = {
  configRelativePath: path.join('.cursor', 'hooks.json'),
  scripts: [
    { templateFile: 'cursor/track-edit.sh', destRelative: path.join('.cursor', 'traverspec-hooks', 'track-edit.sh') },
    {
      templateFile: 'cursor/remind-reconcile.sh',
      destRelative: path.join('.cursor', 'traverspec-hooks', 'remind-reconcile.sh'),
    },
  ],
};

const CLAUDE_CONFIG: ToolHookConfig = {
  configRelativePath: path.join('.claude', 'settings.json'),
  scripts: [
    {
      templateFile: 'claude/track-touched-files.sh',
      destRelative: path.join('.claude', 'hooks', 'track-touched-files.sh'),
    },
    {
      templateFile: 'claude/check-reconciliation.sh',
      destRelative: path.join('.claude', 'hooks', 'check-reconciliation.sh'),
    },
  ],
};

function configFor(tool: HookTool): ToolHookConfig {
  return tool === 'cursor' ? CURSOR_CONFIG : CLAUDE_CONFIG;
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
  const merged = tool === 'cursor' ? mergeCursorHooks(parsed, created, skipped) : mergeClaudeHooks(parsed, created, skipped);

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

function mergeCursorHooks(parsed: any, created: string[], skipped: string[]): any {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) parsed = {};
  if (typeof parsed.version !== 'number') parsed.version = 1;
  if (typeof parsed.hooks !== 'object' || parsed.hooks === null) parsed.hooks = {};

  const entries: Array<{ event: string; command: string }> = [
    { event: 'afterFileEdit', command: '.cursor/traverspec-hooks/track-edit.sh' },
    { event: 'stop', command: '.cursor/traverspec-hooks/remind-reconcile.sh' },
  ];

  for (const { event, command } of entries) {
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

function mergeClaudeHooks(parsed: any, created: string[], skipped: string[]): any {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) parsed = {};
  if (typeof parsed.hooks !== 'object' || parsed.hooks === null) parsed.hooks = {};

  const entries: Array<{ event: string; matcher: string; command: string }> = [
    {
      event: 'PostToolUse',
      matcher: 'Write|Edit',
      command: '$CLAUDE_PROJECT_DIR/.claude/hooks/track-touched-files.sh',
    },
    { event: 'Stop', matcher: '', command: '$CLAUDE_PROJECT_DIR/.claude/hooks/check-reconciliation.sh' },
  ];

  for (const { event, matcher, command } of entries) {
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
 */
export function removeHooks(root: string, tool: HookTool): RemoveHooksResult {
  const config = configFor(tool);
  const configPath = path.join(root, config.configRelativePath);
  const removed: string[] = [];

  if (fs.existsSync(configPath)) {
    let parsed: any;
    try {
      parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err: any) {
      return {
        ok: false,
        reason: `${config.configRelativePath} isn't valid JSON — left untouched. Fix or remove it manually.`,
        removed: [],
      };
    }

    if (parsed?.hooks && typeof parsed.hooks === 'object') {
      if (tool === 'cursor') removeCursorEntries(parsed.hooks, removed);
      else removeClaudeEntries(parsed.hooks, removed);
    }

    fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n');
  }

  for (const script of config.scripts) {
    const destPath = path.join(root, script.destRelative);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
      removed.push(script.destRelative);
    }
  }

  cleanupState(root, tool);

  return { ok: true, removed };
}

function removeCursorEntries(hooks: any, removed: string[]): void {
  const ourCommands = ['.cursor/traverspec-hooks/track-edit.sh', '.cursor/traverspec-hooks/remind-reconcile.sh'];
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    const before = hooks[event].length;
    hooks[event] = hooks[event].filter((h: any) => !ourCommands.includes(h?.command));
    if (hooks[event].length !== before) removed.push(`${event} hook entry`);
    if (hooks[event].length === 0) delete hooks[event];
  }
}

function removeClaudeEntries(hooks: any, removed: string[]): void {
  const ourCommands = [
    '$CLAUDE_PROJECT_DIR/.claude/hooks/track-touched-files.sh',
    '$CLAUDE_PROJECT_DIR/.claude/hooks/check-reconciliation.sh',
  ];
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
    const hooksDir = path.join(root, '.cursor', 'traverspec-hooks');
    const stateDir = path.join(hooksDir, 'state');
    if (fs.existsSync(stateDir)) fs.rmSync(stateDir, { recursive: true, force: true });
    if (fs.existsSync(hooksDir) && fs.readdirSync(hooksDir).length === 0) fs.rmdirSync(hooksDir);
  } else {
    const claudeHooksDir = path.join(root, '.claude', 'hooks');
    if (fs.existsSync(claudeHooksDir)) {
      for (const f of fs.readdirSync(claudeHooksDir)) {
        if (f.startsWith('state-')) fs.unlinkSync(path.join(claudeHooksDir, f));
      }
    }
  }
}
