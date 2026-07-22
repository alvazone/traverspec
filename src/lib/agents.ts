import * as path from 'path';
import { upsertMarkedBlock } from './markerBlock';

export const KNOWN_AGENTS = ['cursor', 'claude'];

const AGENTS_MD_CONTENT =
  'This project uses TraverSpec. Before doing any work — writing code, ' +
  'answering a question about how something works, or authoring/updating a spec — ' +
  'read `traverspec/skills/start_here.md` in full. It tells you what to read next depending on the task. ' +
  'If the user says "spec" or "the spec," they mean this system specifically, not a generic document — route accordingly.';

const CLAUDE_MD_CONTENT = '@AGENTS.md';

export interface ApplyAgentsResult {
  created: string[];
  skipped: string[];
  unknown: string[];
}

/**
 * Writes/updates AGENTS.md (always) and CLAUDE.md (only if 'claude' is
 * requested) via the idempotent marked-block mechanism. Shared by both
 * `init --agent` and `add-agent` so there is exactly one implementation
 * of "how do we inject into a file we don't fully own."
 */
export function applyAgents(root: string, requestedAgents: string[]): ApplyAgentsResult {
  const created: string[] = [];
  const skipped: string[] = [];
  const normalized = requestedAgents.map((a) => a.trim().toLowerCase()).filter(Boolean);
  const unknown = normalized.filter((a) => !KNOWN_AGENTS.includes(a));
  const wantsClaude = normalized.includes('claude');

  record('AGENTS.md', upsertMarkedBlock(path.join(root, 'AGENTS.md'), AGENTS_MD_CONTENT), created, skipped);

  if (wantsClaude) {
    record('CLAUDE.md', upsertMarkedBlock(path.join(root, 'CLAUDE.md'), CLAUDE_MD_CONTENT), created, skipped);
  }

  return { created, skipped, unknown };
}

function record(
  name: string,
  result: 'created' | 'updated' | 'unchanged',
  created: string[],
  skipped: string[]
): void {
  if (result === 'created') created.push(name);
  else if (result === 'updated') created.push(`${name} (updated)`);
  else skipped.push(`${name} (already up to date)`);
}
