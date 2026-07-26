import * as fs from 'fs';
import * as path from 'path';
import { upsertMarkedBlock } from './markerBlock';

export const AGENTS_MD_TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'AGENTS.md');

export function getAgentsMdContent(): string {
  return fs.readFileSync(AGENTS_MD_TEMPLATE_PATH, 'utf8');
}

/**
 * Writes/updates AGENTS.md unconditionally via the idempotent marked-block
 * mechanism. Used by both `init` (always) and bare `add-agent` (a
 * standalone re-application of the same step, e.g. to refresh AGENTS.md
 * without re-running the full scaffold).
 */
export function writeAgentsMd(root: string): 'created' | 'updated' | 'unchanged' {
  return upsertMarkedBlock(path.join(root, 'AGENTS.md'), getAgentsMdContent());
}
