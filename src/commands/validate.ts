import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  checkStructuralShape,
  checkTypeLegality,
  checkReferentialIntegrity,
  checkOverridesDirection,
  checkSequentialNumbering,
  checkSkillFilesPresent,
  Finding,
} from '../lib/rules';

const TEMPLATES_SKILLS_DIR = path.join(__dirname, '..', '..', 'templates', 'skills');

export interface ValidateOptions {
  json?: boolean;
}

export function validateCommand(options: ValidateOptions): void {
  const root = process.cwd();
  const specRoot = path.join(root, 'traverspec');
  const graphPath = path.join(specRoot, 'graph.yaml');

  if (!fs.existsSync(graphPath)) {
    return report([{ rule: 'referential-integrity', message: `traverspec/graph.yaml not found at ${graphPath}` }], options);
  }

  let raw: any;
  try {
    raw = yaml.load(fs.readFileSync(graphPath, 'utf8'));
  } catch (err: any) {
    return report([{ rule: 'yaml-syntax', message: `traverspec/graph.yaml failed to parse: ${err.message}` }], options);
  }

  if (typeof raw !== 'object' || raw === null) {
    return report(
      [{ rule: 'yaml-syntax', message: 'traverspec/graph.yaml did not parse to an object with epics/nodes/edges' }],
      options
    );
  }

  const findings: Finding[] = [
    ...checkStructuralShape(raw),
    ...checkTypeLegality(raw),
    ...checkReferentialIntegrity(raw, specRoot),
    ...checkOverridesDirection(raw),
    ...checkSequentialNumbering(raw),
    ...checkSkillFilesPresent(root, TEMPLATES_SKILLS_DIR),
  ];

  report(findings, options);
}

function report(findings: Finding[], options: ValidateOptions): void {
  if (options.json) {
    console.log(JSON.stringify({ valid: findings.length === 0, findings }, null, 2));
  } else if (findings.length === 0) {
    console.log('traverspec validate: OK — no issues found.');
  } else {
    console.log(`traverspec validate: ${findings.length} issue(s) found.\n`);
    for (const f of findings) {
      console.log(`  [${f.rule}] ${f.message}`);
    }
  }
  process.exitCode = findings.length === 0 ? 0 : 1;
}
