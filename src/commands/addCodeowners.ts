import * as fs from 'fs';
import * as path from 'path';
import { addCodeowners, CodeownersPlatform } from '../lib/codeowners';

export interface AddCodeownersOptions {
  tool?: string;
}

interface CommandError {
  what: string;
  where: string;
  fix: string;
}

function reportError(error: CommandError): void {
  console.error(`traverspec add-codeowners failed: ${error.what}\nWhere: ${error.where}\nFix: ${error.fix}`);
  process.exitCode = 1;
}

export function addCodeownersCommand(options: AddCodeownersOptions): void {
  const root = process.cwd();
  const tool = options.tool?.toLowerCase();

  if (tool !== 'github' && tool !== 'gitlab') {
    console.log('Usage: traverspec add-codeowners --tool <github|gitlab>');
    process.exitCode = 1;
    return;
  }

  const specRoot = path.join(root, 'traverspec');
  if (!fs.existsSync(specRoot)) {
    return reportError({
      what: 'no traverspec/ folder found in this project.',
      where: root,
      fix: 'run `traverspec init` first to scaffold the project, then run this command again.',
    });
  }

  let filePath: string;
  let action: 'created' | 'updated' | 'unchanged';
  try {
    ({ filePath, action } = addCodeowners(root, tool as CodeownersPlatform));
  } catch (err: any) {
    const hint =
      typeof err.message === 'string' && err.message.includes('resolves outside the project')
        ? 'this CODEOWNERS location involves a symlink that escapes the project — remove or fix the symlink, then run this command again.'
        : err.code === 'EACCES' || err.code === 'EPERM'
        ? 'check that the file and its parent directory are writable, then run this command again.'
        : err.code === 'EISDIR'
        ? 'this CODEOWNERS location exists as a directory, not a file — remove or rename it, then run this command again.'
        : err.code === 'EEXIST' || err.code === 'ENOTDIR'
        ? "one of the CODEOWNERS path segments exists as the wrong type on disk (e.g. a plain file where a directory is expected) — remove or rename whatever's blocking it, then run this command again."
        : "run this command again — it's safe to re-run. If this keeps happening, check the target file/directory manually.";
    return reportError({
      what: `couldn't write the CODEOWNERS entry — ${err.message}`,
      where: root,
      fix: hint,
    });
  }

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
