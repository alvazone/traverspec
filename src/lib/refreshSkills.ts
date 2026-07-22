import * as fs from 'fs';
import * as path from 'path';
import { loadSkillVersions, saveSkillVersions, getCurrentPackageVersion } from './skillVersions';
import { CUSTOM_RULES_MARKERS, extractMarkedBlockContent, clearMarkedBlockContent, upsertMarkedBlock } from './markerBlock';

const TEMPLATES_SKILLS_DIR = path.join(__dirname, '..', '..', 'templates', 'skills');

export type SkillFileAction =
  | 'up-to-date'
  | 'missing-will-create'
  | 'stale-identical-will-restamp'
  | 'stale-different-needs-confirmation';

export interface SkillFilePlanEntry {
  file: string;
  action: SkillFileAction;
}

export interface RefreshPlan {
  entries: SkillFilePlanEntry[];
  currentVersion: string;
}

/**
 * Figures out, per skill file, whether it's current, missing, stale but
 * identical to the pristine content (safe to silently re-stamp), or stale
 * with real content differences (needs a human decision before overwriting,
 * since that could be a customization, not just drift).
 */
export function buildRefreshPlan(root: string): RefreshPlan {
  const currentVersion = getCurrentPackageVersion();
  const versions = loadSkillVersions(root);
  const skillsDir = path.join(root, 'traverspec', 'skills');
  const entries: SkillFilePlanEntry[] = [];

  const files = fs.existsSync(TEMPLATES_SKILLS_DIR) ? fs.readdirSync(TEMPLATES_SKILLS_DIR) : [];

  for (const file of files) {
    const localPath = path.join(skillsDir, file);
    const pristinePath = path.join(TEMPLATES_SKILLS_DIR, file);

    if (!fs.existsSync(localPath)) {
      entries.push({ file, action: 'missing-will-create' });
      continue;
    }

    if (versions[file] === currentVersion) {
      entries.push({ file, action: 'up-to-date' });
      continue;
    }

    // No stamp, or a stamp older than the current package version — only
    // the actual content tells us whether there's something real to act on.
    // Compare with each file's custom-rules block cleared out first, since
    // that section is expected to differ (it's the user's own content) and
    // is preserved automatically regardless of which branch this lands in —
    // it should never by itself trigger a confirmation prompt.
    const localContent = fs.readFileSync(localPath, 'utf8');
    const pristineContent = fs.readFileSync(pristinePath, 'utf8');
    const localCore = clearMarkedBlockContent(localContent, CUSTOM_RULES_MARKERS);
    const pristineCore = clearMarkedBlockContent(pristineContent, CUSTOM_RULES_MARKERS);

    entries.push({
      file,
      action: localCore === pristineCore ? 'stale-identical-will-restamp' : 'stale-different-needs-confirmation',
    });
  }

  return { entries, currentVersion };
}

/**
 * Applies a refresh plan. Creating missing files and re-stamping
 * identical-content files always happens — both are lossless. Overwriting
 * a file with real content differences only happens if applyConfirmed is
 * true, since that's the one category that could destroy a customization.
 *
 * Whenever a file actually gets rewritten, whatever was in its custom-rules
 * block beforehand is carried over into the fresh copy — that section is
 * never subject to the confirmation gate above, only the rest of the file is.
 */
export function applyRefreshPlan(root: string, plan: RefreshPlan, applyConfirmed: boolean): void {
  const skillsDir = path.join(root, 'traverspec', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  const versions = loadSkillVersions(root);

  for (const entry of plan.entries) {
    const localPath = path.join(skillsDir, entry.file);
    const pristinePath = path.join(TEMPLATES_SKILLS_DIR, entry.file);

    const shouldWrite =
      entry.action === 'missing-will-create' ||
      entry.action === 'stale-identical-will-restamp' ||
      (entry.action === 'stale-different-needs-confirmation' && applyConfirmed);

    if (!shouldWrite) continue;

    const preservedCustomRules = fs.existsSync(localPath)
      ? extractMarkedBlockContent(fs.readFileSync(localPath, 'utf8'), CUSTOM_RULES_MARKERS)
      : null;

    fs.copyFileSync(pristinePath, localPath);

    if (preservedCustomRules) {
      upsertMarkedBlock(localPath, preservedCustomRules, CUSTOM_RULES_MARKERS);
    }

    versions[entry.file] = plan.currentVersion;
  }

  saveSkillVersions(root, versions);
}
