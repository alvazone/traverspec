#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { addAgentCommand } from './commands/addAgent';
import { addCodeownersCommand } from './commands/addCodeowners';
import { removeCommand } from './commands/remove';
import { refreshSkillsCommand } from './commands/refreshSkills';
import { checkPlanCommand } from './commands/checkPlan';

const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('traverspec')
  .description('Scaffold and validate a typed, traversable spec graph for AI coding agents.')
  .version(version);

program
  .command('init')
  .description('Scaffold the traverspec/ folder structure and agent entry files in the current project')
  .option('--agent <names>', 'comma-separated list of agent tools to wire up (cursor, claude)')
  .action(initCommand);

program
  .command('validate')
  .description('Check traverspec/graph.yaml and skill files for structural and referential integrity')
  .option('--json', 'output machine-readable JSON instead of a human-readable report')
  .action(validateCommand);

program
  .command('add-agent <names>')
  .description('Wire up one or more additional coding tools without re-running init (comma-separated: cursor, claude)')
  .action(addAgentCommand);

program
  .command('add-codeowners')
  .description('Add a CODEOWNERS entry gating traverspec/ behind review (never run automatically by init)')
  .requiredOption('--tool <platform>', 'github or gitlab')
  .action(addCodeownersCommand);

program
  .command('remove')
  .description('Remove traverspec/ and agent entry files from this project, after a confirmation prompt')
  .option('-y, --yes', 'skip the confirmation prompt')
  .action(removeCommand);

program
  .command('refresh-skills')
  .description('Pull in skill-file updates from the installed package version, with confirmation before overwriting any customized file')
  .option('-y, --yes', 'skip the confirmation prompt for files with real content differences')
  .action(refreshSkillsCommand);

program
  .command('check-plan')
  .description('Check whether traverspec/plan/plan.md still matches the current graph.yaml, or is stale')
  .option('--json', 'output machine-readable JSON instead of a human-readable report')
  .action(checkPlanCommand);

program.parseAsync();
