"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const graphYamlParser_1 = require('./graphYamlParser');
const waveSkeleton_1 = require('./waveSkeleton');
/**
 * Entry point bundled into templates/skills/traverspec-waves/scripts/ as
 * plain compiled JS (see build/copySkillScripts.js) — the traverspec-waves
 * skill invokes this via `node <skill dir>/scripts/wave-skeleton.js` to
 * get waves.md's Step 1 mechanical wave skeleton as JSON, instead of
 * hand-simulating the algorithm itself. This file has no dependency on
 * anything outside Node's own stdlib, by design — it has to run standalone
 * in whatever project the skill was copied into.
 */
function main() {
    const graphPath = path.join(process.cwd(), 'traverspec', 'graph.yaml');
    let text;
    try {
        text = fs.readFileSync(graphPath, 'utf8');
    }
    catch {
        process.stderr.write(`wave-skeleton: could not read ${graphPath}\n`);
        process.exit(1);
        return;
    }
    let graph;
    try {
        graph = (0, graphYamlParser_1.parseGraphYamlText)(text);
    }
    catch (err) {
        if (err instanceof graphYamlParser_1.GraphYamlParseError) {
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
    const result = (0, waveSkeleton_1.computeWaveSkeleton)(graph);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
main();
