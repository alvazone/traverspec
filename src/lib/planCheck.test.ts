import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkPlanStatus } from './planCheck';
import { initCommand } from '../commands/init';

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-check-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
  initCommand({});
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('checkPlanStatus', () => {
  it('reports no-plan when traverspec/plan/ has never been created', () => {
    const result = checkPlanStatus(tmpDir);
    expect(result.status).toBe('no-plan');
  });

  it('reports up-to-date when the snapshot matches the live graph exactly', () => {
    const planDir = path.join(tmpDir, 'traverspec', 'plan');
    fs.mkdirSync(planDir, { recursive: true });
    const graphContent = fs.readFileSync(path.join(tmpDir, 'traverspec', 'graph.yaml'), 'utf8');
    fs.writeFileSync(path.join(planDir, 'graph-snapshot.yaml'), graphContent);

    const result = checkPlanStatus(tmpDir);
    expect(result.status).toBe('up-to-date');
  });

  it('reports stale when the live graph has changed since the snapshot was taken', () => {
    const planDir = path.join(tmpDir, 'traverspec', 'plan');
    fs.mkdirSync(planDir, { recursive: true });
    const graphContent = fs.readFileSync(path.join(tmpDir, 'traverspec', 'graph.yaml'), 'utf8');
    fs.writeFileSync(path.join(planDir, 'graph-snapshot.yaml'), graphContent);

    // Simulate the graph moving on after the plan was generated.
    fs.writeFileSync(
      path.join(tmpDir, 'traverspec', 'graph.yaml'),
      graphContent + '\n# a new node was added after the plan snapshot was taken\n'
    );

    const result = checkPlanStatus(tmpDir);
    expect(result.status).toBe('stale');
  });
});
