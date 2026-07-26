import * as fs from 'fs';
import * as path from 'path';
import { parseGraphYamlText, GraphYamlParseError } from '../lib/graphYamlParser';
import { computeWaveSkeleton } from '../lib/waveSkeleton';

/**
 * Entry point bundled into templates/skills/traverspec-waves/scripts/ as
 * plain compiled JS (see build/copySkillScripts.js) — the traverspec-waves
 * skill invokes this via `node <skill dir>/scripts/wave-skeleton.js` to
 * get waves.md's Step 1 mechanical wave skeleton as JSON, instead of
 * hand-simulating the algorithm itself. This file has no dependency on
 * anything outside Node's own stdlib, by design — it has to run standalone
 * in whatever project the skill was copied into.
 */
function main(): void {
  const graphPath = path.join(process.cwd(), 'traverspec', 'graph.yaml');

  let text: string;
  try {
    text = fs.readFileSync(graphPath, 'utf8');
  } catch {
    process.stderr.write(`wave-skeleton: could not read ${graphPath}\n`);
    process.exit(1);
    return;
  }

  let graph;
  try {
    graph = parseGraphYamlText(text);
  } catch (err) {
    if (err instanceof GraphYamlParseError) {
      process.stderr.write(`wave-skeleton: ${err.message}\n`);
      process.exit(1);
      return;
    }
    throw err;
  }

  // computeWaveSkeleton never throws — an unresolved epic-floor cycle comes
  // back as data (wave: null + a reason), not an exception, so Step 2 (the
  // agent's own prose-reading pass) can act on it instead of the whole plan
  // aborting. See waveSkeleton.ts's top-of-file comment for why.
  const result = computeWaveSkeleton(graph);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
