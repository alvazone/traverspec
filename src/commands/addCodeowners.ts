import { addCodeowners, CodeownersPlatform } from '../lib/codeowners';

export interface AddCodeownersOptions {
  tool?: string;
}

export function addCodeownersCommand(options: AddCodeownersOptions): void {
  const root = process.cwd();
  const tool = options.tool?.toLowerCase();

  if (tool !== 'github' && tool !== 'gitlab') {
    console.log('Usage: traverspec add-codeowners --tool <github|gitlab>');
    process.exitCode = 1;
    return;
  }

  const { filePath, action } = addCodeowners(root, tool as CodeownersPlatform);

  console.log('traverspec add-codeowners complete.\n');
  if (action === 'created') console.log(`  + ${filePath}`);
  else if (action === 'updated') console.log(`  + ${filePath} (updated)`);
  else console.log(`  = ${filePath} (already up to date)`);

  console.log(
    '\nThis alone only requests review — it does not block merges yet. Replace the @CHANGE_ME ' +
      'placeholder with a real team or username, then ' +
      (tool === 'github'
        ? 'enable branch protection with "Require review from Code Owners" for your protected branch.'
        : 'tie an approval rule to your protected branch (or declare required approvals directly with [Section][N] syntax in the file).')
  );
}
