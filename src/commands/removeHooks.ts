import { removeHooks, KNOWN_HOOK_TOOLS, HookTool } from '../lib/hooks';

export function removeHooksCommand(tool: string): void {
  const root = process.cwd();
  const normalized = tool?.toLowerCase();

  if (!KNOWN_HOOK_TOOLS.includes(normalized as HookTool)) {
    console.log(`Usage: traverspec remove-hooks <${KNOWN_HOOK_TOOLS.join('|')}>`);
    process.exitCode = 1;
    return;
  }

  const result = removeHooks(root, normalized as HookTool);

  if (!result.ok) {
    console.log(`traverspec remove-hooks: ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  console.log(`traverspec remove-hooks ${normalized} complete.\n`);

  if (result.removed.length) {
    result.removed.forEach((f) => console.log(`  - ${f}`));
  } else {
    console.log('Nothing to remove — no TraverSpec hooks were configured for this tool.');
  }
}
