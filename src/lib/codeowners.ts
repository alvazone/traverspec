import * as fs from 'fs';
import * as path from 'path';
import { upsertMarkedBlock, HASH_COMMENT_MARKERS } from './markerBlock';

export type CodeownersPlatform = 'github' | 'gitlab';

// Both platforms use the first CODEOWNERS file found, in this precedence
// order, and ignore any others present in the repo — verified against
// current docs for each rather than assumed symmetric between the two.
const LOCATIONS: Record<CodeownersPlatform, string[]> = {
  github: ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'],
  gitlab: ['CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'],
};

function blockContent(owner: string): string {
  return (
    `# TraverSpec spec graph — changes here affect both what the spec says\n` +
    `# and how agents read and traverse it. Added by \`traverspec add-codeowners\`.\n` +
    `# Replace the placeholder below with a real team or username before this does anything —\n` +
    `# your git host won't request review from an owner handle that doesn't exist.\n` +
    `/traverspec/ ${owner}`
  );
}

export interface AddCodeownersResult {
  filePath: string;
  action: 'created' | 'updated' | 'unchanged';
}

/**
 * Finds the CODEOWNERS file the target platform actually honors (checking
 * all recognized locations in precedence order, since both platforms
 * silently ignore every location but the first one found), and appends or
 * creates a marked block pointing at traverspec/. Never overwrites
 * unrelated existing content in the file.
 */
export function addCodeowners(root: string, platform: CodeownersPlatform, owner = '@CHANGE_ME'): AddCodeownersResult {
  const locations = LOCATIONS[platform];

  let target: string | undefined;
  for (const loc of locations) {
    const full = path.join(root, loc);
    if (fs.existsSync(full)) {
      target = full;
      break;
    }
  }

  if (!target) {
    target = path.join(root, locations[0]);
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }

  const action = upsertMarkedBlock(target, blockContent(owner), HASH_COMMENT_MARKERS);
  return { filePath: path.relative(root, target), action };
}
