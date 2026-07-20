import * as fs from 'fs';
import * as path from 'path';

const MANIFEST_FILENAME = 'skill-versions.json';

let cachedCurrentVersion: string | undefined;

/**
 * The version of the traverspec package actually running right now —
 * read from this package's own package.json, not the target project's.
 */
export function getCurrentPackageVersion(): string {
  if (cachedCurrentVersion) return cachedCurrentVersion;
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  cachedCurrentVersion = pkg.version as string;
  return cachedCurrentVersion;
}

export type SkillVersions = Record<string, string>;

export function loadSkillVersions(root: string): SkillVersions {
  const manifestPath = path.join(root, 'traverspec', MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return {};
  }
}

export function saveSkillVersions(root: string, versions: SkillVersions): void {
  const manifestPath = path.join(root, 'traverspec', MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(versions, null, 2) + '\n');
}
