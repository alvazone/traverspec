import * as fs from 'fs';
import * as path from 'path';

/**
 * Confirms that `relPath`, resolved from `root`, stays inside the project
 * — following every symlink along the way, including on an ancestor
 * directory rather than just the leaf itself. A target location (or one of
 * its ancestor directories) being a symlink pointing outside the project is
 * either a mistake or a malicious repo trying to make this tool write (or
 * install an executable script) somewhere else entirely; either way,
 * refuse rather than silently following it. Non-existent paths can't be
 * resolved with realpath directly, so this walks up to the deepest
 * ancestor that does exist, resolves that, and re-appends the
 * not-yet-existing remainder.
 *
 * Shared by every command that writes to a path partly named by convention
 * (CODEOWNERS locations, hook config/script paths) rather than a path the
 * caller fully controls itself — anywhere a symlink planted in the
 * repository could redirect a write outside the project.
 */
export function assertPathContained(root: string, relPath: string): void {
  const resolvedRoot = fs.realpathSync(root);
  const target = path.join(root, relPath);

  let existingAncestor = target;
  const pendingSegments: string[] = [];
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break; // reached the filesystem root; nothing exists at all yet
    pendingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parent;
  }

  const resolvedExistingAncestor = fs.realpathSync(existingAncestor);
  const resolvedTarget = pendingSegments.length
    ? path.join(resolvedExistingAncestor, ...pendingSegments)
    : resolvedExistingAncestor;

  const contained = resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
  if (!contained) {
    throw new Error(
      `'${relPath}' resolves outside the project (via a symlink, to '${resolvedTarget}') — refusing to write through it`
    );
  }
}
