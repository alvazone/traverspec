import * as path from 'path';
import { checkWaveStatus, WaveCheckResult } from '../lib/waveCheck';

export interface CheckWavesOptions {
  json?: boolean;
}

interface CommandError {
  what: string;
  where: string;
  fix: string;
}

function reportError(error: CommandError, options: CheckWavesOptions): void {
  if (options.json) {
    console.log(JSON.stringify({ error }, null, 2));
  } else {
    console.error(`traverspec check-waves failed: ${error.what}\nWhere: ${error.where}\nFix: ${error.fix}`);
  }
  process.exitCode = 1;
}

export function checkWavesCommand(options: CheckWavesOptions): void {
  const root = process.cwd();

  let result: WaveCheckResult;
  try {
    result = checkWaveStatus(root);
  } catch (err: any) {
    const hint =
      err.code === 'EACCES' || err.code === 'EPERM'
        ? 'check that traverspec/graph.yaml and traverspec/waves/graph-snapshot.yaml are readable, then run this command again.'
        : err.code === 'EISDIR'
        ? 'one of those paths exists as a directory, not a file — remove or rename it, then run this command again.'
        : "run this command again — it's safe to re-run. If this keeps happening, check those files manually.";
    return reportError(
      {
        what: `couldn't compare the graph against its waves snapshot — ${err.message}`,
        where: path.join(root, 'traverspec'),
        fix: hint,
      },
      options
    );
  }

  report(result, options);
}

function report(result: WaveCheckResult, options: CheckWavesOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`traverspec check-waves: ${result.message}`);
  }
  // 'no-graph' and 'no-snapshot' both mean waves.md exists but can't
  // currently be trusted, the same practical caution as 'stale' — only a
  // clean 'up-to-date' or a genuine 'no-waves' (nothing to trust or
  // distrust yet) exit 0.
  const untrustworthy = result.status === 'stale' || result.status === 'no-snapshot' || result.status === 'no-graph';
  process.exitCode = untrustworthy ? 1 : 0;
}
