import * as fs from 'fs';
import * as path from 'path';
import { applyAgents } from '../lib/agents';
import { loadSkillVersions, saveSkillVersions, getCurrentPackageVersion } from '../lib/skillVersions';

const ASSET_TYPES = [
  'epic',
  'feature',
  'data_model',
  'api_contract',
  'business_rule',
  'decision',
];

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

export interface InitOptions {
  agent?: string;
}

export function initCommand(options: InitOptions): void {
  const root = process.cwd();
  const specRoot = path.join(root, 'traverspec');

  const created: string[] = [];
  const skipped: string[] = [];

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

  const skillsDir = path.join(specRoot, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  const templateSkillsDir = path.join(TEMPLATES_DIR, 'skills');
  const skillVersions = loadSkillVersions(root);
  const currentVersion = getCurrentPackageVersion();
  let skillVersionsChanged = false;
  for (const file of fs.readdirSync(templateSkillsDir)) {
    const dest = path.join(skillsDir, file);
    if (fs.existsSync(dest)) {
      skipped.push(`traverspec/skills/${file}`);
    } else {
      fs.copyFileSync(path.join(templateSkillsDir, file), dest);
      created.push(`traverspec/skills/${file}`);
      skillVersions[file] = currentVersion;
      skillVersionsChanged = true;
    }
  }
  if (skillVersionsChanged) {
    saveSkillVersions(root, skillVersions);
  }

  const requestedAgents = options.agent ? options.agent.split(',') : [];
  const agentResult = applyAgents(root, requestedAgents);
  created.push(...agentResult.created);
  skipped.push(...agentResult.skipped);

  console.log('traverspec init complete.\n');

  if (created.length) {
    console.log('Created:');
    created.forEach((f) => console.log(`  + ${f}`));
  }

  if (skipped.length) {
    console.log('\nAlready present, left untouched:');
    skipped.forEach((f) => console.log(`  = ${f}`));
  }

  if (agentResult.unknown.length) {
    console.log(`\nUnrecognized --agent value(s), ignored: ${agentResult.unknown.join(', ')}`);
  }

  if (!options.agent) {
    console.log(
      '\nNo --agent specified, so only AGENTS.md was written. ' +
        'Run with --agent claude (or --agent cursor,claude) to also wire up CLAUDE.md, ' +
        'or run `traverspec add-agent <name>` later.'
    );
  }

  console.log(
    '\nTip: if your team wants changes to traverspec/skills/ to require review, ' +
      'run `traverspec add-codeowners --tool github` (or --tool gitlab).'
  );
}
