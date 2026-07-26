import * as fs from 'fs';
import * as path from 'path';
import { writeAgentsMd } from '../lib/agents';
import { checkPackageInstallHealthy, installSkillsInto } from '../lib/skillInstall';

const ASSET_TYPES = [
  'epic',
  'feature',
  'data_model',
  'api_contract',
  'business_rule',
  'decision',
];

function brokenInstallError(detail: string): void {
  console.error(
    `traverspec init failed: ${detail}\n` +
      `Fix: this usually means a broken or partial install — reinstall with ` +
      `\`npm install --save-dev @alvazone/traverspec\` and try again.`
  );
  process.exitCode = 1;
}

function record(name: string, result: 'created' | 'updated' | 'unchanged', created: string[], skipped: string[]): void {
  if (result === 'created') created.push(name);
  else if (result === 'updated') created.push(`${name} (updated)`);
  else skipped.push(`${name} (already up to date)`);
}

export function initCommand(): void {
  const root = process.cwd();
  const specRoot = path.join(root, 'traverspec');
  const agentsSkillsDir = path.join(root, '.agents', 'skills');

  // Preflight: catch a broken/partial package install before touching the
  // target project at all, with a message that points at the actual cause
  // instead of a generic failure surfacing later mid-write.
  const health = checkPackageInstallHealthy();
  if (!health.ok) {
    return brokenInstallError(health.detail!);
  }

  const created: string[] = [];
  const skipped: string[] = [];
  let removedOldSkills = false;
  let installedSkills: string[] = [];
  let failedSkills: Array<{ name: string; error: string }> = [];

  try {
    fs.mkdirSync(specRoot, { recursive: true });

    for (const name of ['about.md', 'constitution.md']) {
      const p = path.join(specRoot, name);
      if (fs.existsSync(p)) {
        skipped.push(`traverspec/${name}`);
      } else {
        fs.writeFileSync(p, '');
        created.push(`traverspec/${name}`);
      }
    }

    const graphPath = path.join(specRoot, 'graph.yaml');
    if (fs.existsSync(graphPath)) {
      skipped.push('traverspec/graph.yaml');
    } else {
      fs.writeFileSync(graphPath, 'epics: []\nnodes: []\nedges: []\n');
      created.push('traverspec/graph.yaml');
    }

    const assetsRoot = path.join(specRoot, 'assets');
    for (const type of ASSET_TYPES) {
      const typeDir = path.join(assetsRoot, type);
      fs.mkdirSync(typeDir, { recursive: true });
      const gitkeep = path.join(typeDir, '.gitkeep');
      const hasOtherFiles = fs.readdirSync(typeDir).some((f) => f !== '.gitkeep');
      if (!hasOtherFiles && !fs.existsSync(gitkeep)) {
        fs.writeFileSync(gitkeep, '');
      }
    }

    // traverspec/skills/ is a superseded location — skills now live in
    // .agents/skills/ so most agentic tools pick them up natively. Remove
    // it outright rather than leaving stale content behind.
    const oldSkillsDir = path.join(specRoot, 'skills');
    if (fs.existsSync(oldSkillsDir)) {
      fs.rmSync(oldSkillsDir, { recursive: true, force: true });
      removedOldSkills = true;
    }

    const skillResult = installSkillsInto(agentsSkillsDir, health.skillNames);
    installedSkills = skillResult.installedSkills;
    failedSkills = skillResult.failedSkills;

    record('AGENTS.md', writeAgentsMd(root), created, skipped);
  } catch (err: any) {
    const hint =
      err.code === 'EACCES' || err.code === 'EPERM'
        ? "check that this directory is writable, then run `traverspec init` again — it's safe to re-run."
        : err.code === 'ENOSPC'
        ? "check available disk space, then run `traverspec init` again — it's safe to re-run."
        : "run `traverspec init` again — it's safe to re-run. If this keeps happening, it may indicate a broken install.";
    console.error(`traverspec init failed: ${err.message}\nWhere: writing into ${root}.\nFix: ${hint}`);
    process.exitCode = 1;
    return;
  }

  console.log(failedSkills.length ? 'traverspec init finished with errors.\n' : 'traverspec init complete.\n');

  if (created.length) {
    console.log('Created:');
    created.forEach((f) => console.log(`  + ${f}`));
  }

  if (skipped.length) {
    console.log('\nAlready present, left untouched:');
    skipped.forEach((f) => console.log(`  = ${f}`));
  }

  if (installedSkills.length) {
    console.log(`\nSkills installed fresh in .agents/skills/ (${installedSkills.length}):`);
    installedSkills.forEach((n) => console.log(`  * ${n}`));
  }

  if (removedOldSkills) {
    console.log('\nRemoved traverspec/skills/ — superseded by .agents/skills/.');
  }

  if (failedSkills.length) {
    console.log(`\n${failedSkills.length} skill(s) failed to install:`);
    failedSkills.forEach((f) => console.log(`  ! ${f.name}: ${f.error}`));
    console.log('Fix: run `traverspec init` again — it only retries what failed, everything else is untouched.');
    process.exitCode = 1;
  }

  console.log(
    '\nTip: if your team wants changes to traverspec/ (the graph and assets) to require review, ' +
      'run `traverspec add-codeowners --tool github` (or --tool gitlab).'
  );

  console.log(
    '\nUsing Claude Code? Run `npx traverspec add-agent claude` ' +
      '(or `traverspec add-agent claude` if installed globally) to also wire up CLAUDE.md.'
  );
}
