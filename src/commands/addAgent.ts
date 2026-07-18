import { applyAgents, KNOWN_AGENTS } from '../lib/agents';

export function addAgentCommand(namesArg: string): void {
  const root = process.cwd();
  const requested = namesArg
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    console.log(`Usage: traverspec add-agent <name>[,<name>...]  (supported: ${KNOWN_AGENTS.join(', ')})`);
    process.exitCode = 1;
    return;
  }

  const { created, skipped, unknown } = applyAgents(root, requested);

  console.log('traverspec add-agent complete.\n');

  if (created.length) {
    console.log('Created:');
    created.forEach((f) => console.log(`  + ${f}`));
  }

  if (skipped.length) {
    console.log('\nAlready present, left untouched:');
    skipped.forEach((f) => console.log(`  = ${f}`));
  }

  if (unknown.length) {
    console.log(`\nUnrecognized agent name(s): ${unknown.join(', ')}`);
    console.log(`Supported agents right now: ${KNOWN_AGENTS.join(', ')}`);
    process.exitCode = 1;
  }
}
