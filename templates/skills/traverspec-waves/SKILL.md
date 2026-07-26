---
name: traverspec-waves
description: Derives a dependency-ordered build sequence — feature nodes grouped into sequential waves — from the graph's depends_on/dispatches edges plus a targeted prose-verification pass over the specs those edges can't fully capture. Use when the user asks for a build order, roadmap, wave sequence, or "what should we build first" across some or all features in the graph.
---

# Waves — Deriving a Wave-Based Build Sequence

This file tells you how to produce a **build sequence**: the graph's `feature` nodes grouped into ordered waves, where wave N can only start once every feature in wave N-1 (and earlier) is done. Features in the same wave have no known ordering constraint between them and can be worked in parallel.

This is not a mechanical computation you can fully get right from `graph.yaml` alone. Part of it is — a real graph-traversal pass over explicit edges — but part of it requires reading the prose in `traverspec/assets/`, the same way `traverspec-write` requires reading source material when a fact isn't fully captured as an edge, because some real build-ordering facts are never captured as an edge at all. Do both passes below, in order. Skipping the second pass and shipping only the mechanical skeleton will produce a build sequence that looks complete and is quietly wrong in specific, checkable ways — this file exists because that happened once already.

Load [references/structure_reference.md](references/structure_reference.md) before doing anything else, if you haven't already this session — everything below assumes you know the node/edge schema.

---

## 1. When to run this

The person is asking for a build order, a roadmap, a wave sequence, "what should we build first," or anything phrased in terms of stages/sprints/waves across some or all of the `feature` nodes in the graph.

If `traverspec/waves/waves.md` already exists, don't assume it's still accurate — run `traverspec check-waves`. A `stale` result means the graph has moved since those waves were generated; redo Steps 1–2 below rather than presenting the existing file as current. An `up-to-date` result means the existing waves are still trustworthy and there's no need to redo the work from scratch. A `no-waves` result (the snapshot file is missing even though `waves.md` itself exists, e.g. it was copied or hand-created without it) means there's nothing to trust either, treat it the same as `stale` and redo Steps 1–2.

---

## 2. Step 1 — Mechanical skeleton

Run the bundled script instead of computing this by hand: `node scripts/wave-skeleton.js` from this skill's own folder. It reads `traverspec/graph.yaml` from the current working directory — run it from the project root. It prints one JSON object to stdout:

```json
{ "waves": [ { "featureId": "feature:x", "wave": 2, "reasons": [ /* see below */ ] } ], "maxWave": 2 }
```

Every feature in the graph gets exactly one entry. `wave` is a positive integer, except for the two "unresolved" cases below, where it's `null`. `reasons` is never empty:

| `reasons[].kind` | Meaning |
|---|---|
| `no-constraint` | Nothing orders this feature — it can start immediately. |
| `direct-edge` | A specific `depends_on`/`dispatches` edge of this feature's own put it here; `predecessorId`/`edge` name it. |
| `epic-floor` | No edge of its own — inherited from its epic's floor; `predecessorId`/`edge`/`fromEpic`/`toEpic` name the specific sibling feature and cross-epic fact that caused it. |
| `cycle-group` | A genuine mutual dependency — `members` lists the other features that must be planned as one unit with this one, at the same wave. |
| `unresolved-epic-floor-cycle` | The mechanical epic-floor rule produced a contradiction (two epics that each require the other). `wave` is `null`. `cycleMembers` names the other feature(s) actually caught in it; `contributingEdges` names the real edges whose epic-floor generalizations collided. This is not a hand-off to the person yet — see Step 2. |
| `blocked-by-unresolved-cycle` | Not itself cyclic — this feature just depends (directly or transitively) on something stuck in an `unresolved-epic-floor-cycle`. `cycleMembers` names that cycle. Its real wave follows once Step 2 resolves it. |

If the script exits non-zero instead of printing JSON, it's a `graph.yaml` formatting problem — the stderr message states exactly what's wrong, where, and the fix. Apply the fix directly (this is ordinary `traverspec-write` territory; a plain formatting correction doesn't need to be asked about first) and re-run the script.

Do not hand-compute any of this yourself, and don't second-guess the script's output by re-deriving the algorithm from first principles — its direction rule, cycle handling, and epic-floor logic are all deliberately non-obvious in ways this file used to spell out and no longer needs to, because nothing here has to reason about them anymore.

---

## 3. Step 2 — Prose verification pass

The mechanical skeleton is a real, correct computation over the edges that exist — but some true build-ordering facts are never written down as an edge, because the two features involved don't have one directly and don't even share an epic. Catching those requires reading content, not more graph traversal.

**Unresolved features come first, before the scan below even starts.** A `wave: null` feature (`unresolved-epic-floor-cycle` or `blocked-by-unresolved-cycle`) is a mechanical contradiction, not just thin evidence — the epic-floor rule generalized a single feature pair's real dependency into an epic-wide requirement, and two such generalizations collided. That doesn't mean the underlying edges are wrong; it means only reading the actual specs can say whether either generalization was ever true for this specific feature. For each `unresolved-epic-floor-cycle` feature, read its own asset file, the asset files of everything in its `cycleMembers`, and the asset files of the features named in its `contributingEdges`. Then:

1. **Neither requirement holds for this feature** — place it from its own direct edges only, as if the epic floor never applied; note in the output that the mechanical floor was overridden by reading the spec.
2. **One requirement holds, the other doesn't** — place it after whichever predecessor the prose actually supports.
3. **Genuinely can't tell, or the specs actively conflict** — surface it to the person as a graph inconsistency, same as the rule further below for a prose-derived fact contradicting an edge. Don't silently pick a side.

Once every `unresolved-epic-floor-cycle` feature is settled, every `blocked-by-unresolved-cycle` feature just inherits its wave from its own direct predecessors' now-settled waves — nothing further to read for those.

**Do not** use naming conventions — HTTP verb prefixes on `api_contract` ids, GraphQL mutation name prefixes, or anything similar — as a stand-in for reading prose in this step. It doesn't generalize across API styles and was deliberately rejected in favor of the prose pass.

**Where to look.** Prioritize features whose Step 1 `reasons` are thin — no `direct-edge` of their own, only an `epic-floor` reason, or resting on a `reads`/`mutates` relationship to a `data_model` that other features also touch. For each of those, read:
- the feature's own asset file,
- the `data_model` files it `mutates`, `reads`, or reaches via `foreign_key`,
- the `business_rule` files it `enforces`,
- any connected `decision` node.

**What you're looking for**, in roughly descending order of how often it matters:
1. **A shared-`data_model` dependency.** `references/structure_reference.md` §3a defines exactly this test — read it there rather than re-deriving it here. If it applies, reorder the consumer after the creator (or after the field's sole writer).
2. **Explicit causality language not yet backed by an edge** — "runs only after X reaches Y," "enqueues Z once W completes" — describing a real relationship that should already be a `dispatches` or `depends_on` edge per `references/structure_reference.md` but isn't. Treat this as evidence for the build sequence; separately, flag it back to the person as a likely missing edge, since the graph itself should probably gain it.

**Evidence and restraint.** Same standard as `references/structure_reference.md` §3a and §3: only reorder on an explicit statement, never on inferred association or two features merely feeling related, and never just because they share a model — most shared-model pairs are peers with no real order between them. If you're not sure whether what you read counts as explicit, it doesn't — leave the mechanical placement as-is.

**If a prose-derived fact contradicts an explicit edge** (the edges say one order, the prose clearly states another), do not silently pick one. Surface it to the person as a graph inconsistency — that's a sign the graph itself has drifted from what the specs say, which is worth fixing at the source, not papering over in the output.

---

## 4. Output

1. Ensure `traverspec/waves/` exists — create it if it doesn't.
2. Copy the exact `traverspec/graph.yaml` you computed these waves from into `traverspec/waves/graph-snapshot.yaml`, verbatim. This lets a future run (or a human) check whether the graph has drifted since the waves were made.
3. Write `traverspec/waves/waves.md`, replacing it wholesale if it already exists — this is a derived artifact regenerated fresh each run, not something to hand-edit or patch incrementally (same reasoning `references/structure_reference.md` §5 gives for why nodes don't carry hand-maintained status fields: they drift and go stale).

**Before writing each feature's checkbox, do a quick completion check.** Read the feature's own asset file to understand everything it's supposed to do, then check whether the code actually covers all of it — following its `calls`/`mutates`/`reads` edges toward more concrete nodes (`api_contract`, `data_model`, `ui_component`), the same way `traverspec-reconcile` locates code, since a `feature` node itself has no direct code pointer. A partial or stub implementation — a scaffold, a subset of the described behavior, a TODO-riddled skeleton — does not count as complete. This is a lightweight completeness check, not a reconciliation — it's answering "has this been fully built," not "does the implementation still match the spec exactly" (behavioral drift in something that IS fully built is still `traverspec-reconcile`'s job, not this skill's). If you're not sure whether it's genuinely complete, leave it unchecked; a false "done" is worse than an honest "unclear," same standard as Step 2's evidence discipline.

Mark the checkbox `- [x]` instead of `- [ ]` only when you're confident the feature is fully implemented, and cite what you found (a file, a function, a test name — same citation discipline `traverspec-reconcile` uses, not a vague "looks implemented"). Leave it `- [ ]` otherwise, including when only part of it is done.

**This is not a substitute for `traverspec-reconcile`.** A checked box means "this appears fully implemented," nothing more — it says nothing about whether that implementation still matches the spec correctly. If the person wants to know whether already-built features have drifted from their specs, that's `traverspec-reconcile`'s job, not this skill's.

Format `waves.md` as one `## Wave N` heading per wave, in order, each containing one checkbox per feature:

```markdown
# Build Waves

Generated from `graph-snapshot.yaml` in this same folder.

## Wave 1
- [x] feature:sign-in — no ordering constraints; already implemented, see src/auth/signin.ts
- [ ] feature:sign-up — no ordering constraints

## Wave 2
- [ ] feature:onboarding-conversation — depends_on feature:sign-up
- [ ] feature:pattern-detective — epic floor (epic:ai-pipeline requires epic:daily-metrics, via feature:insights-orchestrator depends_on feature:daily-metrics-computation); confirm against §3 prose pass before treating this placement as final

## Wave 6
- [ ] feature:note-capture — mutual-dependency group with feature:voice-capture-pipeline, feature:note-enrichment
- [ ] feature:voice-capture-pipeline — mutual-dependency group with feature:note-capture, feature:note-enrichment
- [ ] feature:note-enrichment — mutual-dependency group with feature:note-capture, feature:voice-capture-pipeline
```

Every checkbox line carries its provenance from Step 1's `reasons` or Step 2 — never a bare feature id with no reason. If Step 2 changed a feature's wave from where Step 1 placed it, say so and cite what was read (e.g. "moved after feature:onboarding-session-2 — its spec creates the `MorningRoutineItemDef` rows this feature deletes").

Any feature still unresolved after Step 2 (outcome 3 above, or anything raised to the person and not yet settled) goes into a final, unnumbered section instead of a `## Wave N`:

```markdown
## Unresolved
- [ ] feature:x2 — epic-floor conflict between epic:x and epic:y could not be resolved by reading specs; surfaced to the person as a graph inconsistency
```

Every other feature — including one a `null` wave was overridden for by reading prose in Step 2 — gets a normal `## Wave N` entry citing what was read, exactly like any other Step 2 correction.

---

## 5. What this skill does not do

It does not estimate effort, assign people, or produce a calendar/timeline — waves are ordering only, not scheduling. It does not modify `traverspec/graph.yaml` — if Step 2 surfaces a missing edge, tell the person; don't add it yourself as a side effect of computing waves. It does not need to re-verify every feature's prose on every run — if `traverspec check-waves` shows no change, the prior waves are still valid and you don't need to redo the reading pass from scratch.
