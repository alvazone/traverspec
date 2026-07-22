import * as fs from 'fs';

export interface MarkerStyle {
  start: string;
  end: string;
}

export const HTML_COMMENT_MARKERS: MarkerStyle = {
  start: '<!-- traverspec:start -->',
  end: '<!-- traverspec:end -->',
};

export const HASH_COMMENT_MARKERS: MarkerStyle = {
  start: '# traverspec:start',
  end: '# traverspec:end',
};

export const CUSTOM_RULES_MARKERS: MarkerStyle = {
  start: '<!-- traverspec:custom-rules:start -->',
  end: '<!-- traverspec:custom-rules:end -->',
};

/**
 * Create or update a marked block inside a file, leaving everything
 * outside the markers untouched. Appends if the file exists but has
 * no marked block yet; replaces just the block on repeat runs.
 */
export function upsertMarkedBlock(
  filePath: string,
  blockContent: string,
  markers: MarkerStyle = HTML_COMMENT_MARKERS
): 'created' | 'updated' | 'unchanged' {
  const block = `${markers.start}\n${blockContent.trim()}\n${markers.end}`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, block + '\n');
    return 'created';
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(markers.start);
  const endIdx = existing.indexOf(markers.end);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(filePath, existing + separator + block + '\n');
    return 'created';
  }

  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + markers.end.length);
  const existingBlock = existing.slice(startIdx, endIdx + markers.end.length);

  if (existingBlock === block) {
    return 'unchanged';
  }

  fs.writeFileSync(filePath, before + block + after);
  return 'updated';
}

/**
 * Read-only counterpart to upsertMarkedBlock, operating on a string already
 * in memory rather than a file path. Returns the trimmed inner content of
 * the marked block, or null if the markers aren't present.
 */
export function extractMarkedBlockContent(
  content: string,
  markers: MarkerStyle = HTML_COMMENT_MARKERS
): string | null {
  const startIdx = content.indexOf(markers.start);
  const endIdx = content.indexOf(markers.end);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return null;
  }

  return content.slice(startIdx + markers.start.length, endIdx).trim();
}

/**
 * Returns content with the marked block's inner text collapsed to nothing,
 * markers themselves left in place. Lets a caller compare two versions of a
 * file while ignoring whatever currently sits inside the block — used to
 * tell "only the preserved section differs" apart from "the actual content
 * differs" without needing to know what's in the block ahead of time.
 */
export function clearMarkedBlockContent(
  content: string,
  markers: MarkerStyle = HTML_COMMENT_MARKERS
): string {
  const startIdx = content.indexOf(markers.start);
  const endIdx = content.indexOf(markers.end);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return content;
  }

  return content.slice(0, startIdx + markers.start.length) + '\n' + content.slice(endIdx);
}

export type RemoveResult = 'file-deleted' | 'block-stripped' | 'not-found';

/**
 * Inverse of upsertMarkedBlock. If the file has no marked block, does
 * nothing. If removing the block leaves nothing else behind, deletes
 * the file entirely rather than leaving an empty husk. Otherwise strips
 * just the block and leaves surrounding content untouched.
 */
export function removeMarkedBlock(
  filePath: string,
  markers: MarkerStyle = HTML_COMMENT_MARKERS,
  options: { dryRun?: boolean } = {}
): RemoveResult {
  if (!fs.existsSync(filePath)) {
    return 'not-found';
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(markers.start);
  const endIdx = existing.indexOf(markers.end);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return 'not-found';
  }

  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + markers.end.length);
  const remaining = (before + after).trim();

  if (remaining === '') {
    if (!options.dryRun) fs.unlinkSync(filePath);
    return 'file-deleted';
  }

  if (!options.dryRun) {
    fs.writeFileSync(filePath, remaining.replace(/\n{3,}/g, '\n\n') + '\n');
  }
  return 'block-stripped';
}
