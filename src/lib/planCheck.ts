import * as fs from 'fs';
import * as path from 'path';

export type PlanStatus = 'no-plan' | 'up-to-date' | 'stale';

export interface PlanCheckResult {
  status: PlanStatus;
  message: string;
}

/**
 * Compares traverspec/plan/graph-snapshot.yaml (the exact graph state a plan
 * was generated from, per plan.md's output contract) against the live
 * traverspec/graph.yaml. A byte-for-byte match means the plan still reflects
 * reality; any difference means the graph moved since the plan was written
 * and traverspec/plan/plan.md should be regenerated before being trusted.
 */
export function checkPlanStatus(root: string): PlanCheckResult {
  const graphPath = path.join(root, 'traverspec', 'graph.yaml');
  const snapshotPath = path.join(root, 'traverspec', 'plan', 'graph-snapshot.yaml');

  if (!fs.existsSync(snapshotPath)) {
    return {
      status: 'no-plan',
      message:
        'No traverspec/plan/graph-snapshot.yaml found — no plan has been generated yet. ' +
        'Run the plan skill before relying on traverspec/plan/plan.md.',
    };
  }

  if (!fs.existsSync(graphPath)) {
    return {
      status: 'no-plan',
      message: 'traverspec/graph.yaml not found — cannot compare it against the plan snapshot.',
    };
  }

  const graphContent = fs.readFileSync(graphPath, 'utf8');
  const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');

  if (graphContent === snapshotContent) {
    return {
      status: 'up-to-date',
      message: 'traverspec/plan/plan.md matches the current graph.yaml — safe to rely on.',
    };
  }

  return {
    status: 'stale',
    message:
      'traverspec/graph.yaml has changed since traverspec/plan/plan.md was generated — ' +
      'regenerate the plan before relying on it.',
  };
}
