import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  checkStructuralShape,
  checkTypeLegality,
  checkReferentialIntegrity,
  checkAssetContentPresence,
  checkOverridesDirection,
  checkSequentialNumbering,
  checkGraphYamlSubsetCompatibility,
  Finding,
} from '../lib/rules';

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

  const text = fs.readFileSync(graphPath, 'utf8');

  let raw: any;
  try {
    raw = yaml.load(text);
  } catch (err: any) {
    return report([{ rule: 'yaml-syntax', message: `traverspec/graph.yaml failed to parse: ${err.message}` }], options);
  }

  if (typeof raw !== 'object' || raw === null) {
    return report(
      [{ rule: 'yaml-syntax', message: 'traverspec/graph.yaml did not parse to an object with epics/nodes/edges' }],
      options
    );
  }

  const topLevelShapeFindings: Finding[] = [];
  for (const key of ['epics', 'nodes', 'edges'] as const) {
    if (key in raw && !Array.isArray(raw[key])) {
      topLevelShapeFindings.push({
        rule: 'yaml-syntax',
        message: `traverspec/graph.yaml's '${key}:' must be a list of entries, not ${
          raw[key] === null ? 'null' : typeof raw[key] === 'object' ? 'a mapping' : typeof raw[key]
        }`,
      });
    }
  }
  if (topLevelShapeFindings.length) {
    return report(topLevelShapeFindings, options);
  }

  let findings: Finding[];
  try {
    findings = [
      ...checkStructuralShape(raw),
      ...checkTypeLegality(raw),
      ...checkReferentialIntegrity(raw, specRoot),
      ...checkAssetContentPresence(raw, specRoot),
      ...checkOverridesDirection(raw),
      ...checkSequentialNumbering(raw),
      ...checkGraphYamlSubsetCompatibility(text),
    ];
  } catch (err: any) {
    return report(
      [
        {
          rule: 'internal-error',
          message: `validate hit an unexpected error checking traverspec/graph.yaml: ${err.message}. This is likely a bug in traverspec itself, not a problem with your graph — please report it.`,
        },
      ],
      options
    );
  }

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
