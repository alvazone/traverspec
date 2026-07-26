#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { addAgentCommand } from './commands/addAgent';
import { addCodeownersCommand } from './commands/addCodeowners';
import { removeCommand } from './commands/remove';
import { checkWavesCommand } from './commands/checkWaves';
import { listCommand } from './commands/list';
import { showCommand } from './commands/show';
import { addHooksCommand } from './commands/addHooks';
import { removeHooksCommand } from './commands/removeHooks';

const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('traverspec')
  .description('Scaffold and validate a typed, traversable spec graph for AI coding agents.')
  .version(version);

program
  .command('init')
  .description('Scaffold the traverspec/ folder structure, install skills to .agents/skills/, and write AGENTS.md')
  .action(initCommand);

program
  .command('validate')
  .description('Check traverspec/graph.yaml and skill files for structural and referential integrity')
  .option('--json', 'output machine-readable JSON instead of a human-readable report')
  .action(validateCommand);

program
  .command('list')
  .description('List every node with a lightweight id/type/title/description index, for resolving a node id before using show')
  .option('--type <type>', 'filter to one node type')
  .option('--json', 'output machine-readable JSON instead of a human-readable list')
  .action(listCommand);

program
  .command('show <node_ids>')
  .description('Show the dependency/impact closure for one or more node ids (comma-separated)')
  .option('--direction <direction>', "forward, reverse, or both (default: both)", 'both')
  .option('--json', 'output machine-readable JSON instead of a human-readable edge list')
  .action(showCommand);

program
  .command('add-agent [agent]')
  .description('Wire up AGENTS.md + .agents/skills/ (no argument), or `claude` for CLAUDE.md + .claude/skills/')
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
  .command('check-waves')
  .description('Check whether traverspec/waves/waves.md still matches the current graph.yaml, or is stale')
  .option('--json', 'output machine-readable JSON instead of a human-readable report')
  .action(checkWavesCommand);

program
  .command('add-hooks <tool>')
  .description(
    'Wire up reconciliation hooks for an agent tool (cursor or claude) — opt-in, merges into any existing hooks config, never run automatically'
  )
  .action(addHooksCommand);

program
  .command('remove-hooks <tool>')
  .description(
    "Remove only TraverSpec's own reconciliation hook entries for an agent tool (cursor or claude), leaving any other existing hooks untouched"
  )
  .action(removeHooksCommand);

program.parseAsync();
