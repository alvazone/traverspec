import { checkPlanStatus, PlanCheckResult } from '../lib/planCheck';

export interface CheckPlanOptions {
  json?: boolean;
}

export function checkPlanCommand(options: CheckPlanOptions): void {
  const result = checkPlanStatus(process.cwd());
  report(result, options);
}

function report(result: PlanCheckResult, options: CheckPlanOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`traverspec check-plan: ${result.message}`);
  }
  process.exitCode = result.status === 'stale' ? 1 : 0;
}
