import * as fs from 'fs';
import * as path from 'path';
import { upsertMarkedBlock } from '../lib/markerBlock';
import { getAgentsMdContent } from '../lib/agents';
import { checkPackageInstallHealthy, installSkillsInto } from '../lib/skillInstall';

interface CommandError {
  what: string;
  where: string;
  fix: string;
}

function record(name: string, result: 'created' | 'updated' | 'unchanged', created: string[], skipped: string[]): void {
  if (result === 'created') created.push(name);
  else if (result === 'updated') created.push(`${name} (updated)`);
  else skipped.push(`${name} (already up to date)`);
}

function reportError(error: CommandError): void {
  console.error(`traverspec add-agent failed: ${error.what}\nWhere: ${error.where}\nFix: ${error.fix}`);
  process.exitCode = 1;
}

/**
 * Bare `add-agent` wires up AGENTS.md + .agents/skills/, read natively by
 * most agentic coding tools. `add-agent claude` is a separate, claude-only
 * track — CLAUDE.md + .claude/skills/ instead, not layered on top of the
 * bare behavior. Run both if a project wants both.
 */
export function addAgentCommand(agentArg?: string): void {
  const root = process.cwd();
  const specRoot = path.join(root, 'traverspec');
  const normalized = (agentArg ?? '').trim().toLowerCase();

  if (normalized && normalized !== 'claude') {
    return reportError({
      what: `'${agentArg}' is not a supported add-agent parameter.`,
      where: 'command-line argument.',
      fix: 'only `claude` is supported as a parameter now — every other coding tool reads AGENTS.md and .agents/skills/ natively, so run `traverspec add-agent` with no argument instead.',
    });
  }

  const isClaude = normalized === 'claude';

  if (!fs.existsSync(specRoot)) {
    return reportError({
      what: 'no traverspec/ folder found in this project.',
      where: root,
      fix: 'run `traverspec init` first to scaffold the project, then run this command again.',
    });
  }

  const health = checkPackageInstallHealthy();
  if (!health.ok) {
    return reportError({
      what: health.detail!,
      where: 'the installed traverspec package.',
      fix: 'this usually means a broken or partial install — reinstall with `npm install --save-dev @alvazone/traverspec` and try again.',
    });
  }

  const created: string[] = [];
  const skipped: string[] = [];

  const targetFile = isClaude ? 'CLAUDE.md' : 'AGENTS.md';
  record(targetFile, upsertMarkedBlock(path.join(root, targetFile), getAgentsMdContent()), created, skipped);

  const skillsDirLabel = isClaude ? '.claude/skills' : '.agents/skills';
  const skillsDir = path.join(root, isClaude ? '.claude' : '.agents', 'skills');
  const { installedSkills, failedSkills } = installSkillsInto(skillsDir, health.skillNames);

  console.log(failedSkills.length ? 'traverspec add-agent finished with errors.\n' : 'traverspec add-agent complete.\n');

  if (created.length) {
    console.log('Created:');
    created.forEach((f) => console.log(`  + ${f}`));
  }

  if (skipped.length) {
    console.log('\nAlready present, left untouched:');
    skipped.forEach((f) => console.log(`  = ${f}`));
  }

  if (installedSkills.length) {
    console.log(`\nSkills installed fresh in ${skillsDirLabel}/ (${installedSkills.length}):`);
    installedSkills.forEach((n) => console.log(`  * ${n}`));
  }

  if (failedSkills.length) {
    console.log(`\n${failedSkills.length} skill(s) failed to install:`);
    failedSkills.forEach((f) => console.log(`  ! ${f.name}: ${f.error}`));
    console.log('Fix: run this command again — it retries the failed skill install, everything else is unaffected.');
    process.exitCode = 1;
  }
}
