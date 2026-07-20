import * as readline from 'readline/promises';
import { buildRemovalPlan, executeRemovalPlan } from '../lib/remove';

export interface RemoveOptions {
  yes?: boolean;
}

export async function removeCommand(options: RemoveOptions): Promise<void> {
  const root = process.cwd();
  const actions = buildRemovalPlan(root);

  if (actions.length === 0) {
    console.log('Nothing to remove — no traverspec/ folder or agent entry files found here.');
    return;
  }

  console.log('This will remove:');
  for (const action of actions) {
    console.log(`  - ${action.label}`);
  }
  console.log();

  if (!options.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('Proceed? [y/N] ')).trim().toLowerCase();
    rl.close();
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Aborted — nothing was changed.');
      return;
    }
  }

  executeRemovalPlan(root, actions);
  console.log('Done.');
}
