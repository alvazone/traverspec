import * as readline from 'readline/promises';
import { buildRemovalPlan, executeRemovalPlan } from '../lib/remove';

export interface RemoveOptions {
  yes?: boolean;
}

export async function removeCommand(options: RemoveOptions): Promise<void> {
  const root = process.cwd();
  const actions = buildRemovalPlan(root);

  if (actions.length === 0) {
    console.log('Nothing to remove — no traverspec/ folder, agent entry files, skills, or hooks found here.');
    return;
  }

  console.log('This will remove:');
  for (const action of actions) {
    console.log(`  - ${action.label}`);
  }
  console.log();

  if (!options.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('This cannot be undone. Type "delete" to proceed: ')).trim();
    rl.close();
    if (answer !== 'delete') {
      console.log('Aborted — nothing was changed.');
      return;
    }
  }

  const outcomes = executeRemovalPlan(root, actions);
  const failed = outcomes.filter((o) => !o.ok);

  if (failed.length === 0) {
    console.log('Done.');
    return;
  }

  const succeeded = outcomes.filter((o) => o.ok);
  console.log(`Finished with errors — ${succeeded.length} of ${outcomes.length} item(s) removed successfully.\n`);
  if (succeeded.length) {
    console.log('Removed:');
    succeeded.forEach((o) => console.log(`  - ${o.action.label}`));
  }
  console.log(`\n${failed.length} item(s) failed:`);
  failed.forEach((o) => console.log(`  ! ${o.action.label} — ${o.error}`));
  console.log(
    '\nRun `traverspec remove` again to retry what failed — everything already removed above is safe to leave as is.'
  );
  process.exitCode = 1;
}
