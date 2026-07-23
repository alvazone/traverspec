# Plan — Deriving a Wave-Based Build Sequence

This file tells you how to produce a **build plan**: the graph's `feature` nodes grouped into ordered waves, where wave N can only start once every feature in wave N-1 (and earlier) is done. Features in the same wave have no known ordering constraint between them and can be worked in parallel.

This is not a mechanical computation you can fully get right from `graph.yaml` alone. Part of it is — a real graph-traversal pass over explicit edges — but part of it requires reading the prose in `traverspec/assets/` the same way `derive_spec_from_code.md` and `ingest_spec.md` require reading source material, because some real build-ordering facts are never captured as an edge at all. Do both passes below, in order. Skipping the second pass and shipping only the mechanical skeleton will produce a plan that looks complete and is quietly wrong in specific, checkable ways — this file exists because that happened once already.

---

## 1. When to run this

The person is asking for a build order, a roadmap, a sequencing plan, "what should we build first," or anything phrased in terms of stages/sprints/waves across some or all of the `feature` nodes in the graph. Read `structure_reference.md` first if you haven't already this session — everything below assumes you know the node/edge schema.

If `traverspec/plan/plan.md` already exists, don't assume it's still accurate — run `traverspec check-plan` if the CLI is available (per `start_here.md`'s convention for checking tool availability). A `stale` result means the graph has moved since that plan was generated; redo Steps 1–2 below rather than presenting the existing file as current. An `up-to-date` result means the existing plan is still trustworthy and there's no need to redo the work from scratch. A `no-plan` result (the snapshot file is missing even though `plan.md` itself exists, e.g. it was copied or hand-created without it) means there's nothing to trust either, treat it the same as `stale` and redo Steps 1–2.

---

## 2. Step 1 — Mechanical skeleton

Do this with a real computation — write a short throwaway script (Python or Node, whatever's available) that parses `traverspec/graph.yaml` and computes the following. Do not attempt to hand-simulate graph algorithms over more than a handful of nodes; it's unreliable at any real scale and there's no reason to when a script gets it right deterministically.

**a. Collect ordering edges.** Take every `depends_on` and `dispatches` edge where both `from` and `to` are `feature` nodes. Build one directed adjacency graph from them, with this rule for which side points which way:

| Edge type | Contributes | Why |
|---|---|---|
| `depends_on` | `from` comes after `to` | `to` is the static prerequisite — this is what the edge already means. |
| `dispatches` | `from` comes **before** `to` | `dispatches` states that finishing `from` is what causes `to` to run. Build order should follow that same causal direction — build the trigger, then build what it triggers into. |

**This is not the same directional rule for both edge types, and that asymmetry is intentional.** An earlier attempt at this treated `dispatches` the same way as `depends_on` (assuming the target of a dispatch must be built first, so the dispatcher has something to call into) and shipped a plan that was backwards for exactly this reason. Do not revert to that assumption.

**b. Collapse real cycles.** Run Tarjan's SCC (or equivalent) over the combined adjacency from (a). Any strongly-connected component with more than one member is a genuine mutual dependency — those features must be planned as a single unit, not sequenced relative to each other. Collapse each into one group node before continuing; a plain topological sort over a graph that still contains a cycle will silently strand those nodes instead of erroring, so don't skip this step.

**c. Epic floor.** `epic` is a label, not an edge (per `structure_reference.md` §4) — but it's still useful here as a purely mechanical signal, no prose required. For every ordering fact you already derived in (a) — after applying the `dispatches` flip, not from the raw `from`/`to` — where the two features belong to different epics, record that fact one level up: *epic(later feature)* comes after *epic(earlier feature)*. This gives every feature in an epic a floor: it cannot be placed earlier than its own epic's earliest possible position, even if that specific feature has no direct edge of its own. A feature with zero outgoing edges is not automatically "wave 1" — check whether any of its epic siblings pull the whole epic later.

Compute this floor once, here, from the raw edges only — before Step 2 exists. Do not recompute or re-cascade it afterward. If Step 2 later moves a feature to a later wave, that correction applies to that feature alone; it does not retroactively raise the epic floor for some other epic that merely shares an epic with the moved feature. A prose-derived fact about one feature is not evidence about its epic-siblings' relationship to a third epic — that would need its own citation under Step 2's evidence discipline, not an automatic inheritance through the epic label.

**d. One unified pass.** Compute final wave numbers by running a single topological wave assignment (Kahn's algorithm: repeatedly place every node with no remaining unresolved predecessor, then move to the next wave) over groups-from-(b), using both the real inter-group edges from (a) and the synthetic epic-floor edges from (c) *together, in one graph*. Do not compute feature-level waves and epic-level waves as two separate numberings and combine them afterward (e.g. by taking a max) — the two numberings are on different scales and combining them after the fact can silently produce an ordering that violates a real edge. Verify this yourself once you have an answer: for every `depends_on`/`dispatches` edge between two features, confirm the `from` feature's final wave number is not less than the `to` feature's, honoring the direction rule from (a).

**e. Record provenance.** For every feature, keep a note of *why* it landed in its wave: a specific edge of its own, inherited from an epic floor (and which sibling feature's edge caused it, and which two epics), or membership in a collapsed cycle group. You need this for step 4 — without it, two unrelated features landing in the same wave for coincidental reasons will read as if they're connected, which is misleading to whoever reads the plan.

**Do not** use naming conventions — HTTP verb prefixes on `api_contract` ids, GraphQL mutation name prefixes, or anything similar — as a stand-in for reading prose in the step below. It doesn't generalize across API styles and was deliberately rejected in favor of the prose pass.

---

## 3. Step 2 — Prose verification pass

The mechanical skeleton is a real, correct computation over the edges that exist — but some true build-ordering facts are never written down as an edge, because the two features involved don't have one directly and don't even share an epic. Catching those requires reading content, not more graph traversal.

**Where to look.** Prioritize features whose wave 2(e) provenance is thin — no direct edge of their own, placed only by an epic floor, or resting on a `reads`/`mutates` relationship to a `data_model` that other features also touch. For each of those, read:
- the feature's own asset file,
- the `data_model` files it `mutates`, `reads`, or reaches via `foreign_key`,
- the `business_rule` files it `enforces`,
- any connected `decision` node.

**What you're looking for**, in roughly descending order of how often it matters:
1. **A shared-`data_model` dependency.** `structure_reference.md` §3a defines exactly this test — read it there rather than re-deriving it here. If it applies, reorder the consumer after the creator (or after the field's sole writer).
2. **Explicit causality language not yet backed by an edge** — "runs only after X reaches Y," "enqueues Z once W completes" — describing a real relationship that should already be a `dispatches` or `depends_on` edge per `structure_reference.md` but isn't. Treat this as evidence for the plan; separately, flag it back to the person as a likely missing edge, since the graph itself should probably gain it.

**Evidence and restraint.** Same standard as `structure_reference.md` §3a and §3: only reorder on an explicit statement, never on inferred association or two features merely feeling related, and never just because they share a model — most shared-model pairs are peers with no real order between them. If you're not sure whether what you read counts as explicit, it doesn't — leave the mechanical placement as-is.

**If a prose-derived fact contradicts an explicit edge** (the edges say one order, the prose clearly states another), do not silently pick one. Surface it to the person as a graph inconsistency — that's a sign the graph itself has drifted from what the specs say, which is worth fixing at the source, not papering over in the plan output.

---

## 4. Output

1. Ensure `traverspec/plan/` exists — create it if it doesn't.
2. Copy the exact `traverspec/graph.yaml` you computed this plan from into `traverspec/plan/graph-snapshot.yaml`, verbatim. This lets a future run (or a human) check whether the graph has drifted since the plan was made.
3. Write `traverspec/plan/plan.md`, replacing it wholesale if it already exists — this is a derived artifact regenerated fresh each run, not something to hand-edit or patch incrementally (same reasoning `structure_reference.md` §5 gives for why nodes don't carry hand-maintained status fields: they drift and go stale).

Format `plan.md` as one `## Wave N` heading per wave, in order, each containing one checkbox per feature:

```markdown
# Build Plan

Generated from `graph-snapshot.yaml` in this same folder.

## Wave 1
- [ ] feature:sign-in — no ordering constraints
- [ ] feature:sign-up — no ordering constraints

## Wave 2
- [ ] feature:onboarding-conversation — depends_on feature:sign-up
- [ ] feature:pattern-detective — epic floor (epic:ai-pipeline requires epic:daily-metrics, via feature:insights-orchestrator depends_on feature:daily-metrics-computation); confirm against §3 prose pass before treating this placement as final

## Wave 6
- [ ] feature:note-capture — mutual-dependency group with feature:voice-capture-pipeline, feature:note-enrichment
- [ ] feature:voice-capture-pipeline — mutual-dependency group with feature:note-capture, feature:note-enrichment
- [ ] feature:note-enrichment — mutual-dependency group with feature:note-capture, feature:voice-capture-pipeline
```

Every checkbox line carries its provenance from step 2(e) or step 3 — never a bare feature id with no reason. If step 3 changed a feature's wave from where step 2 placed it, say so and cite what was read (e.g. "moved after feature:onboarding-session-2 — its spec creates the `MorningRoutineItemDef` rows this feature deletes").

---

## 5. What this skill does not do

It does not estimate effort, assign people, or produce a calendar/timeline — waves are ordering only, not scheduling. It does not modify `traverspec/graph.yaml` — if step 3 surfaces a missing edge, tell the person; don't add it yourself as a side effect of planning. It does not need to re-verify every feature's prose on every run — if `traverspec check-plan` (or a manual comparison of `graph-snapshot.yaml` against the current `graph.yaml`, if the CLI isn't available) shows no change, the prior plan is still valid and you don't need to redo the reading pass from scratch.

---

## Custom rules

Add project-specific rules or exceptions for this skill below. Everything else in this file can be overwritten when `traverspec refresh-skills` pulls in a package update — content between these two markers never is.

<!-- traverspec:custom-rules:start -->
(No custom rules yet for this project.)
<!-- traverspec:custom-rules:end -->
