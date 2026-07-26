'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Runs after `tsc` as part of `npm run build`. The traverspec-waves skill
 * ships a bundled, dependency-free script (see src/scripts/wave-skeleton.ts
 * for why it can't just be TypeScript run in place) — this copies the
 * compiled output from dist/ into the actual template folder that
 * init/refreshSkills hand out to projects.
 *
 * Agent Skills folders only get scripts/, references/, assets/ — no
 * further subfolders, and no extra top-level folder like lib/ either. Both
 * of wave-skeleton's dependencies are already dependency-free on their own
 * (verified — zero require() calls in either compiled file), so they're
 * copied flat into scripts/ right next to the entry point, with the entry
 * point's two relative requires rewritten from dist/'s '../lib/...' shape
 * to a same-directory './...' shape to match.
 */
const SCRIPTS_DIR = path.join(__dirname, '..', 'templates', 'skills', 'traverspec-waves', 'scripts');
const DIST_DIR = path.join(__dirname, '..', 'dist');

function readCompiled(relPath) {
  const from = path.join(DIST_DIR, relPath);
  if (!fs.existsSync(from)) {
    console.error(`copySkillScripts: expected compiled output at ${from} — did tsc run first?`);
    process.exit(1);
  }
  return fs.readFileSync(from, 'utf8');
}

fs.mkdirSync(SCRIPTS_DIR, { recursive: true });

for (const name of ['graphYamlParser.js', 'waveSkeleton.js']) {
  const contents = readCompiled(path.join('lib', name));
  fs.writeFileSync(path.join(SCRIPTS_DIR, name), contents);
  console.log(`copySkillScripts: dist/lib/${name} -> templates/skills/traverspec-waves/scripts/${name}`);
}

let entry = readCompiled(path.join('scripts', 'wave-skeleton.js'));
const rewritten = entry
  .replace(/require\((["'])\.\.\/lib\/graphYamlParser\1\)/, "require('./graphYamlParser')")
  .replace(/require\((["'])\.\.\/lib\/waveSkeleton\1\)/, "require('./waveSkeleton')");
if (rewritten === entry) {
  console.error('copySkillScripts: expected to rewrite two ../lib/... require() calls in wave-skeleton.js, found none — did the compiled output change shape?');
  process.exit(1);
}
fs.writeFileSync(path.join(SCRIPTS_DIR, 'wave-skeleton.js'), rewritten);
console.log('copySkillScripts: dist/scripts/wave-skeleton.js -> templates/skills/traverspec-waves/scripts/wave-skeleton.js (requires rewritten to same-directory)');
