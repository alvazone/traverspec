import * as fs from 'fs';
import * as path from 'path';
import { removeMarkedBlock, HTML_COMMENT_MARKERS, HASH_COMMENT_MARKERS, MarkerStyle } from './markerBlock';
import { assertPathContained } from './pathSafety';
import { removeHooks, hookConfigPath, HookTool } from './hooks';

const CODEOWNERS_LOCATIONS = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'];
const SKILLS_LOCATIONS = [path.join('.agents', 'skills'), path.join('.claude', 'skills')];
const HOOK_TOOLS: HookTool[] = ['cursor', 'claude'];

export interface RemovalAction {
  relPath: string;
  label: string;
  kind: 'delete-folder' | 'delete-file' | 'strip-block' | 'remove-hooks';
  markers?: MarkerStyle;
  hookTool?: HookTool;
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    count += entry.isDirectory() ? countFiles(full) : 1;
  }
  return count;
}

/**
 * Figures out everything traverspec would remove from this project,
 * without changing anything — used to show a preview before asking
 * for confirmation.
 *
 * Deliberately never removes .agents/skills/, .claude/skills/, .agents/,
 * or .claude/ themselves, however empty they end up — those are shared
 * locations other tools use too, not traverspec's to delete. Only the
 * individual traverspec-* skill folders inside them are ever touched.
 */
export function buildRemovalPlan(root: string): RemovalAction[] {
  const actions: RemovalAction[] = [];

  const specRoot = path.join(root, 'traverspec');
  if (fs.existsSync(specRoot)) {
    actions.push({
      relPath: 'traverspec',
      label: `traverspec/ (${countFiles(specRoot)} files)`,
      kind: 'delete-folder',
    });
  }

  for (const skillsRel of SKILLS_LOCATIONS) {
    const skillsDir = path.join(root, skillsRel);
    if (!fs.existsSync(skillsDir)) continue;
    const names = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('traverspec-'))
      .map((e) => e.name)
      .sort();
    for (const name of names) {
      const rel = path.join(skillsRel, name);
      actions.push({ relPath: rel, label: `${rel}/`, kind: 'delete-folder' });
    }
  }

  for (const tool of HOOK_TOOLS) {
    const preview = removeHooks(root, tool, { dryRun: true });
    // A symlink-escape (or any other) failure here is treated the same as
    // "nothing found" — same policy as the marked-block check below: if we
    // can't safely determine what's there, don't offer to touch it.
    if (preview.ok && preview.removed.length) {
      actions.push({
        relPath: hookConfigPath(tool),
        label: `${tool} hooks (${preview.removed.join(', ')})`,
        kind: 'remove-hooks',
        hookTool: tool,
      });
    }
  }

  const markedFiles: Array<{ relPath: string; markers: MarkerStyle }> = [
    { relPath: 'AGENTS.md', markers: HTML_COMMENT_MARKERS },
    { relPath: 'CLAUDE.md', markers: HTML_COMMENT_MARKERS },
    ...CODEOWNERS_LOCATIONS.map((relPath) => ({ relPath, markers: HASH_COMMENT_MARKERS })),
  ];

  for (const { relPath, markers } of markedFiles) {
    try {
      assertPathContained(root, relPath);
    } catch {
      continue; // resolves outside the project via a symlink — refuse to even offer touching it
    }
    const full = path.join(root, relPath);
    const result = removeMarkedBlock(full, markers, { dryRun: true });
    if (result === 'file-deleted') {
      actions.push({
        relPath,
        label: `${relPath} — entirely traverspec's, will be deleted`,
        kind: 'delete-file',
        markers,
      });
    } else if (result === 'block-stripped') {
      actions.push({
        relPath,
        label: `${relPath} — has other content, only the traverspec block will be removed`,
        kind: 'strip-block',
        markers,
      });
    }
  }

  return actions;
}

export interface RemovalOutcome {
  action: RemovalAction;
  ok: boolean;
  error?: string;
}

/**
 * Executes a previously-built plan, one action at a time, each fully
 * isolated from the others. The confirmation prompt between planning and
 * this call is a real, human-timescale window for the filesystem to
 * change underneath the plan — a file getting locked, a permission
 * changing, a symlink appearing — so nothing here assumes the plan is
 * still accurate. A failure on one action never crashes the loop (which
 * would silently abandon every action still queued after it) and never
 * gets discarded either (which would report success when something
 * actually failed) — every action's real outcome is returned so the
 * caller can report exactly what happened.
 */
export function executeRemovalPlan(root: string, actions: RemovalAction[]): RemovalOutcome[] {
  const outcomes: RemovalOutcome[] = [];

  for (const action of actions) {
    try {
      if (action.kind === 'remove-hooks') {
        const result = removeHooks(root, action.hookTool!);
        if (!result.ok) throw new Error(result.reason);
        outcomes.push({ action, ok: true });
        continue;
      }

      if (action.kind === 'delete-folder') {
        // fs.rmSync never dereferences a symlink for deletion — whether the
        // target itself is a symlink or one is a symlink was planted inside
        // it, only the symlink entry is ever removed, never what it points
        // to. Safe by construction, no containment check needed here.
        fs.rmSync(path.join(root, action.relPath), { recursive: true, force: true });
        outcomes.push({ action, ok: true });
        continue;
      }

      // delete-file / strip-block go through removeMarkedBlock, which does
      // follow symlinks (it reads and can write the target) — re-check
      // containment right before touching it, matching the plan-build
      // check, as defense against the target changing since planning.
      assertPathContained(root, action.relPath);
      removeMarkedBlock(path.join(root, action.relPath), action.markers!);
      outcomes.push({ action, ok: true });
    } catch (err: any) {
      outcomes.push({ action, ok: false, error: err.message });
    }
  }

  return outcomes;
}
