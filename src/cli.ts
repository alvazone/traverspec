#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { addAgentCommand } from './commands/addAgent';
import { addCodeownersCommand } from './commands/addCodeowners';

const program = new Command();

program
  .name('traverspec')
  .description('Scaffold and validate a typed, traversable spec graph for AI coding agents.')
  .version('0.1.0');

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
  .description('Add a CODEOWNERS entry gating traverspec/skills/ behind review (never run automatically by init)')
  .requiredOption('--tool <platform>', 'github or gitlab')
  .action(addCodeownersCommand);

program.parse();
