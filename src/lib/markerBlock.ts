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
