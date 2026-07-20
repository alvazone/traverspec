import * as fs from 'fs';
import * as path from 'path';
import { removeMarkedBlock, HTML_COMMENT_MARKERS, HASH_COMMENT_MARKERS, MarkerStyle } from './markerBlock';

const CODEOWNERS_LOCATIONS = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'];

export interface RemovalAction {
  relPath: string;
  label: string;
  kind: 'delete-folder' | 'delete-file' | 'strip-block';
  markers?: MarkerStyle;
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

  const markedFiles: Array<{ relPath: string; markers: MarkerStyle }> = [
    { relPath: 'AGENTS.md', markers: HTML_COMMENT_MARKERS },
    { relPath: 'CLAUDE.md', markers: HTML_COMMENT_MARKERS },
    ...CODEOWNERS_LOCATIONS.map((relPath) => ({ relPath, markers: HASH_COMMENT_MARKERS })),
  ];

  for (const { relPath, markers } of markedFiles) {
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

export function executeRemovalPlan(root: string, actions: RemovalAction[]): void {
  for (const action of actions) {
    const full = path.join(root, action.relPath);
    if (action.kind === 'delete-folder') {
      fs.rmSync(full, { recursive: true, force: true });
    } else {
      removeMarkedBlock(full, action.markers!);
    }
  }
}
