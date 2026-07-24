import { addHooks, KNOWN_HOOK_TOOLS, HookTool } from '../lib/hooks';

export function addHooksCommand(tool: string): void {
  const root = process.cwd();
  const normalized = tool?.toLowerCase();

  if (!KNOWN_HOOK_TOOLS.includes(normalized as HookTool)) {
    console.log(`Usage: traverspec add-hooks <${KNOWN_HOOK_TOOLS.join('|')}>`);
    process.exitCode = 1;
    return;
  }

  const result = addHooks(root, normalized as HookTool);

  if (!result.ok) {
    console.log(`traverspec add-hooks: ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  console.log(`traverspec add-hooks ${normalized} complete.\n`);

  if (result.created.length) {
    console.log('Created:');
    result.created.forEach((f) => console.log(`  + ${f}`));
  }

  if (result.skipped.length) {
    console.log('\nAlready present, left untouched:');
    result.skipped.forEach((f) => console.log(`  = ${f}`));
  }

  console.log(
    '\nThis merges into your existing hooks config — any other hooks already there are untouched. ' +
      `Run \`traverspec remove-hooks ${normalized}\` to undo just this.`
  );
}
