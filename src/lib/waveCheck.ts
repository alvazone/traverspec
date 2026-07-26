import * as fs from 'fs';
import * as path from 'path';

export type WaveStatus = 'no-waves' | 'no-graph' | 'no-snapshot' | 'up-to-date' | 'stale';

export interface WaveCheckResult {
  status: WaveStatus;
  message: string;
}

/**
 * Compares traverspec/waves/graph-snapshot.yaml (the exact graph state the
 * waves were generated from, per waves.md's output contract) against the
 * live traverspec/graph.yaml. A byte-for-byte match means the waves still
 * reflect reality; any difference means the graph moved since they were
 * written and traverspec/waves/waves.md should be regenerated before being
 * trusted.
 *
 * Status is decided from the existence of all three files, checked
 * independently in order of what matters most, rather than nested
 * existence checks that only cover one combination at a time — that's
 * what previously let an orphaned snapshot with no waves.md be reported as
 * "up to date," or a missing live graph.yaml be lumped in with "nothing
 * generated yet." waves.md is checked first (nothing else matters if
 * there's no waves.md to trust or distrust), then graph.yaml (nothing to
 * compare against without it), then the snapshot, then the actual
 * comparison.
 */
export function checkWaveStatus(root: string): WaveCheckResult {
  const graphPath = path.join(root, 'traverspec', 'graph.yaml');
  const wavesDir = path.join(root, 'traverspec', 'waves');
  const wavesMdPath = path.join(wavesDir, 'waves.md');
  const snapshotPath = path.join(wavesDir, 'graph-snapshot.yaml');

  if (!fs.existsSync(wavesMdPath)) {
    return {
      status: 'no-waves',
      message:
        'No traverspec/waves/waves.md found — no waves have been generated yet. ' +
        'Run the traverspec-waves skill before relying on traverspec/waves/waves.md.',
    };
  }

  if (!fs.existsSync(graphPath)) {
    return {
      status: 'no-graph',
      message:
        "traverspec/waves/waves.md exists, but traverspec/graph.yaml is missing, so staleness can't be verified. " +
        'Restore graph.yaml, or regenerate the waves once it exists again, before trusting waves.md.',
    };
  }

  if (!fs.existsSync(snapshotPath)) {
    return {
      status: 'no-snapshot',
      message:
        "traverspec/waves/waves.md exists, but traverspec/waves/graph-snapshot.yaml is missing, so staleness can't be verified. " +
        'Either the traverspec-waves run that made it never finished, or the snapshot was deleted/excluded afterward — ' +
        'regenerate the waves (or restore the snapshot) before trusting waves.md.',
    };
  }

  const graphContent = fs.readFileSync(graphPath, 'utf8');
  const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');

  if (graphContent === snapshotContent) {
    return {
      status: 'up-to-date',
      message: 'traverspec/waves/waves.md matches the current graph.yaml — safe to rely on.',
    };
  }

  return {
    status: 'stale',
    message:
      'traverspec/graph.yaml has changed since traverspec/waves/waves.md was generated — ' +
      'regenerate the waves before relying on it.',
  };
}
