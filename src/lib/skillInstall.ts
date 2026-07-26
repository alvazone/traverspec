import * as fs from 'fs';
import * as path from 'path';
import { AGENTS_MD_TEMPLATE_PATH } from './agents';

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');
export const TEMPLATE_SKILLS_DIR = path.join(TEMPLATES_DIR, 'skills');

export interface PackageHealthCheck {
  ok: boolean;
  detail?: string;
  skillNames: string[];
}

/**
 * Checks that the installed traverspec package itself isn't broken or
 * partial, before anything tries to read from it. Returns the current set
 * of packaged skill names when healthy. Shared by init and add-agent,
 * since both install skills from the same package templates.
 */
export function checkPackageInstallHealthy(): PackageHealthCheck {
  if (!fs.existsSync(TEMPLATE_SKILLS_DIR)) {
    return { ok: false, detail: `bundled skill templates not found at ${TEMPLATE_SKILLS_DIR}.`, skillNames: [] };
  }
  if (!fs.existsSync(AGENTS_MD_TEMPLATE_PATH)) {
    return { ok: false, detail: `bundled AGENTS.md template not found at ${AGENTS_MD_TEMPLATE_PATH}.`, skillNames: [] };
  }

  const skillNames = fs
    .readdirSync(TEMPLATE_SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('traverspec-'))
    .map((entry) => entry.name)
    .sort();

  if (skillNames.length === 0) {
    return { ok: false, detail: `no skills found under ${TEMPLATE_SKILLS_DIR}.`, skillNames: [] };
  }

  return { ok: true, skillNames };
}

export interface SkillInstallResult {
  installedSkills: string[];
  failedSkills: Array<{ name: string; error: string }>;
}

/**
 * Installs one skill folder into <skillsDir>/<name> without ever leaving
 * that path missing or half-written. Builds the fresh copy in a sibling
 * .new staging folder first — if that fails, the existing skill (if any) is
 * completely untouched. Only once the new copy is fully ready does it swap
 * in via rename, moving whatever was there before out of the way first
 * (also a rename, not a delete) so the only failure-sensitive gap is the
 * instant between two rename syscalls, not an entire copy.
 */
function installSkill(skillsDir: string, name: string): void {
  const dest = path.join(skillsDir, name);
  const tmpNew = path.join(skillsDir, `.${name}.new`);
  const tmpOld = path.join(skillsDir, `.${name}.old`);

  fs.rmSync(tmpNew, { recursive: true, force: true });
  fs.rmSync(tmpOld, { recursive: true, force: true });

  try {
    fs.cpSync(path.join(TEMPLATE_SKILLS_DIR, name), tmpNew, { recursive: true });
    if (fs.existsSync(dest)) {
      fs.renameSync(dest, tmpOld);
    }
    fs.renameSync(tmpNew, dest);
  } finally {
    // Best-effort cleanup of staging folders. Never let a cleanup failure
    // hide the real error from the caller.
    try {
      fs.rmSync(tmpNew, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(tmpOld, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Skills are vendor-managed, not project-edited in place: wipes every
 * existing traverspec-* folder in skillsDir first — regardless of whether
 * the current package still ships that name, which is what cleans up a
 * skill that got renamed or discontinued in a newer version — then
 * installs skillNames fresh. Only entries matching the traverspec- prefix
 * are touched, so anything else already in skillsDir (another tool's own
 * skills) is left alone. Each skill installs independently — one skill's
 * failure doesn't block or corrupt the others. Trade-off accepted: a
 * skill whose install fails after the wipe ends up missing (not stale)
 * until a successful retry, since there's no longer a previous copy to
 * fall back to.
 */
export function installSkillsInto(skillsDir: string, skillNames: string[]): SkillInstallResult {
  fs.mkdirSync(skillsDir, { recursive: true });

  const existingTraverspecEntries = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('traverspec-'))
    .map((entry) => entry.name);

  const installedSkills: string[] = [];
  const failedSkills: Array<{ name: string; error: string }> = [];
  const wipeFailed = new Set<string>();

  for (const name of existingTraverspecEntries) {
    try {
      fs.rmSync(path.join(skillsDir, name), { recursive: true, force: true });
    } catch (err: any) {
      wipeFailed.add(name);
      failedSkills.push({ name, error: `couldn't remove the existing folder: ${err.message}` });
    }
  }

  for (const name of skillNames) {
    if (wipeFailed.has(name)) continue; // already reported above; its old folder is still there, untouched
    try {
      installSkill(skillsDir, name);
      installedSkills.push(name);
    } catch (err: any) {
      failedSkills.push({ name, error: err.message });
    }
  }

  return { installedSkills, failedSkills };
}
