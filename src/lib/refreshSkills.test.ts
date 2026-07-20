import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildRefreshPlan, applyRefreshPlan } from './refreshSkills';
import { getCurrentPackageVersion, loadSkillVersions } from './skillVersions';
import { initCommand } from '../commands/init';

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildRefreshPlan / applyRefreshPlan', () => {
  it('a fresh init leaves every skill file up to date', () => {
    initCommand({});
    const plan = buildRefreshPlan(tmpDir);
    expect(plan.entries.every((e) => e.action === 'up-to-date')).toBe(true);
    expect(plan.currentVersion).toBe(getCurrentPackageVersion());
  });

  it('recreates a skill file that is missing entirely, no confirmation needed', () => {
    initCommand({});
    fs.unlinkSync(path.join(tmpDir, 'traverspec', 'skills', 'ingest_spec.md'));

    const plan = buildRefreshPlan(tmpDir);
    const entry = plan.entries.find((e) => e.file === 'ingest_spec.md');
    expect(entry?.action).toBe('missing-will-create');

    applyRefreshPlan(tmpDir, plan, false); // even without confirming the "different" category
    expect(fs.existsSync(path.join(tmpDir, 'traverspec', 'skills', 'ingest_spec.md'))).toBe(true);
  });

  it('silently re-stamps a file whose stamp is stale but content already matches pristine', () => {
    initCommand({});
    const versionsPath = path.join(tmpDir, 'traverspec', 'skill-versions.json');
    const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
    versions['start_here.md'] = '0.0.1'; // simulate an old stamp, content untouched
    fs.writeFileSync(versionsPath, JSON.stringify(versions));

    const plan = buildRefreshPlan(tmpDir);
    const entry = plan.entries.find((e) => e.file === 'start_here.md');
    expect(entry?.action).toBe('stale-identical-will-restamp');

    applyRefreshPlan(tmpDir, plan, false);
    const updatedVersions = loadSkillVersions(tmpDir);
    expect(updatedVersions['start_here.md']).toBe(getCurrentPackageVersion());
  });

  it('flags a customized file as needing confirmation, and does not overwrite it without one', () => {
    initCommand({});
    const skillPath = path.join(tmpDir, 'traverspec', 'skills', 'start_here.md');
    fs.appendFileSync(skillPath, '\nCUSTOMIZED BY USER\n');
    const versionsPath = path.join(tmpDir, 'traverspec', 'skill-versions.json');
    const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
    versions['start_here.md'] = '0.0.1';
    fs.writeFileSync(versionsPath, JSON.stringify(versions));

    const plan = buildRefreshPlan(tmpDir);
    const entry = plan.entries.find((e) => e.file === 'start_here.md');
    expect(entry?.action).toBe('stale-different-needs-confirmation');

    applyRefreshPlan(tmpDir, plan, false);
    expect(fs.readFileSync(skillPath, 'utf8')).toContain('CUSTOMIZED BY USER');

    applyRefreshPlan(tmpDir, plan, true);
    expect(fs.readFileSync(skillPath, 'utf8')).not.toContain('CUSTOMIZED BY USER');
  });
});
