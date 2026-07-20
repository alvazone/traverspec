import * as readline from 'readline/promises';
import { buildRefreshPlan, applyRefreshPlan } from '../lib/refreshSkills';

export interface RefreshSkillsOptions {
  yes?: boolean;
}

export async function refreshSkillsCommand(options: RefreshSkillsOptions): Promise<void> {
  const root = process.cwd();
  const plan = buildRefreshPlan(root);

  const missing = plan.entries.filter((e) => e.action === 'missing-will-create');
  const restamp = plan.entries.filter((e) => e.action === 'stale-identical-will-restamp');
  const needsConfirmation = plan.entries.filter((e) => e.action === 'stale-different-needs-confirmation');
  const upToDate = plan.entries.filter((e) => e.action === 'up-to-date');

  if (!missing.length && !restamp.length && !needsConfirmation.length) {
    console.log(`All skill files are already up to date with the installed package (v${plan.currentVersion}).`);
    return;
  }

  console.log(`Checked against installed package v${plan.currentVersion}:\n`);

  if (upToDate.length) {
    console.log(`Already up to date (${upToDate.length}): ${upToDate.map((e) => e.file).join(', ')}`);
  }
  if (missing.length) {
    console.log(`Missing, will be created fresh: ${missing.map((e) => e.file).join(', ')}`);
  }
  if (restamp.length) {
    console.log(
      `Stale version stamp but content already matches — will silently re-stamp: ${restamp
        .map((e) => e.file)
        .join(', ')}`
    );
  }

  let applyConfirmed = false;

  if (needsConfirmation.length) {
    console.log(
      `\nContent differs from the current package version (this may be your own customization) — ` +
        `overwriting will discard local changes to:`
    );
    needsConfirmation.forEach((e) => console.log(`  - ${e.file}`));
    console.log();

    if (options.yes) {
      applyConfirmed = true;
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question('Overwrite these with the current package version? [y/N] '))
        .trim()
        .toLowerCase();
      rl.close();
      applyConfirmed = answer === 'y' || answer === 'yes';
      if (!applyConfirmed) {
        console.log('Skipped — those files were left untouched.');
      }
    }
  }

  applyRefreshPlan(root, plan, applyConfirmed);
  console.log('\nDone.');
}
