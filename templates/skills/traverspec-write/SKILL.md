---
name: traverspec-write
description: Write a new fact into the spec graph, or correct one already there, from a document, existing code, live conversation, or any mix of evidence. Use when creating or updating a node or edge in traverspec/graph.yaml — ingesting a document, deriving from code, authoring through conversation, or any other change to the graph's content.
---

# Write the Graph

This file is for writing a new fact into the graph, or correcting one that's already there, regardless of where the evidence for that fact currently lives. Run the loop below per fact, as many times as a session needs it — don't pre-classify the task by evidence source before starting.

This is not `reconcile.md`'s job in the deliberate-sweep sense (checking a chosen scope of *existing* nodes against code, on an explicit ask or a session-start habit) — though it uses the same reconciliation technique, just triggered by whatever you happen to be writing right now instead of a deliberate audit.

---

## The loop

Run this for every fact that needs to go into, or be corrected in, the graph. It is not a one-time mode chosen at the start of a task — re-enter it as often as the work actually requires, including mid-implementation, mid-bug-fix, or mid-conversation. Load [references/structure_reference.md](references/structure_reference.md) first, if you haven't already this session — it's the schema: what a node, a field, and an edge actually are, which step 1 already assumes.

1. **Identify the fact** — a node, a field, an edge, a correction to something already written.
2. **Gather whatever evidence currently exists for it right now.** Could be a document, existing code, something the person just said, an existing graph node, several of these at once, or nothing but a half-formed idea. Don't assume there's exactly one source before checking. **Whatever you gather here is the batch** — a whole document, a whole vertical slice of code, one diff, or just this one fact if that's all there is. Its boundary is whatever you actually gathered, nothing more abstract than that. A couple of things below (the shared-`data_model` check, the closing summary) key off this boundary — they run once you've worked through everything in the batch, not after each individual fact, and not on some separately-defined notion of a "session" or "task."
3. **No evidence beyond a vague idea** → go to *Elicitation*, below.
4. **Exactly one piece of evidence** → apply that evidence type's calibration (*Evidence calibration*, below), then confidence-gate it (*Confidence-gating*, below).
5. **Two or more pieces of evidence for the same fact** — including an existing graph node as one of them — → go to *Cross-source reconciliation*, below, before writing anything.
6. **Write it** → *Writing it*, below.

---

## Evidence calibration

Each evidence type has its own calibration reference — load the one that matches what you actually have right now:

- [references/document.md](references/document.md) — an existing document (a PDF, notes, pasted text, a Notion export).
- [references/code.md](references/code.md) — existing code (a repo, a module, a set of files).
- [references/conversation.md](references/conversation.md) — something the person is telling you directly, right now.

---

## Elicitation: when only the person can close a gap

Use this any time evidence — whether there's none at all, or something with a real ambiguity in it — can't be resolved without asking. That covers step 3's zero-evidence case, a low-confidence gap inside otherwise-good evidence (*Confidence-gating*, below), and the "nobody's said which side is authoritative" branch of *Cross-source reconciliation*, below. Same technique in all three places, just triggered by different amounts of missing information.

Don't run a rigid checklist of questions. Ask what's actually needed to move from "there's a gap" to "this is clear enough to write," and stop once you have that — not once you've exhausted a list. Before asking anything: would the answer change what you write, or just add detail you'd write anyway? If it wouldn't change the output, skip it. If you already know the answer from earlier in the conversation, don't ask again.

Ask one thing at a time — a short, specific question, not a general "does this look right?" A wall of questions up front is worse than one well-chosen question, an answer, and a natural follow-up.

**If this fired mid-batch** — one ambiguous fact inside an otherwise-clear document or code slice — don't block the rest of the batch on it. Keep working through the rest while the question is pending, and come back to this one fact once it's answered.

**Once you have an answer, treat it as resolving the gap, not as a second, competing source to weigh.** Go straight to *Writing it*, below, the same as any other high-confidence fact — no need to run *Cross-source reconciliation* on your own question and its answer. (If the answer actually contradicts the evidence you already had, rather than clarifying it, that's a real conflict now — go to *Cross-source reconciliation* instead.)

Write the fact once you can fill in its schema without inventing anything the person hasn't actually told you. If you notice yourself about to fill in a plausible-sounding detail they never stated, that's the signal to ask instead of proceeding — not because the guess is necessarily wrong, but because it's not yet theirs. After writing, briefly reflect back what you wrote and confirm it's right — cheaper to catch a gap now than after more has been built on top of it.

---

## Confidence-gating: the rule for any evidence, regardless of source

This applies no matter which evidence-calibration reference fired.

**High confidence — write it directly.** The evidence states something explicitly and unambiguously, mapping onto exactly one node or edge type with no real alternative reading.

**Low confidence — stop and ask, don't guess-and-assert.** The evidence could plausibly be read more than one way, implies a relationship without stating it, or would require inventing a name, id, or categorization not actually present in what you have. Don't pick the most-likely-sounding interpretation and move on — use *Elicitation*, above, to close the gap.

A fabricated answer is worse than a flagged gap. A missing detail is visibly incomplete; a fabricated one looks authoritative and isn't.

This governs *when* you write, never *what's valid once you do*. Confidence-gating does not lower the bar for what counts as a valid node or edge — everything produced still has to conform to the schema exactly.

---

## Cross-source reconciliation: when more than one piece of evidence exists

Use this whenever step 5 applies. Sort what the evidence shows into exactly one of three outcomes:

1. **Match.** The sources agree. No action beyond writing it once.
2. **Drift.** The sources disagree — a document says one thing, code does another; code has moved on from what a graph node currently states; two things handed to you conflict. **Do not silently resolve this in either direction.** The newer source isn't automatically right (it could be a regression); the older source isn't automatically right either (it could be stale). Two ways this resolves:
   - **The person has already told you which side wins** — e.g. "add this change to the spec, from the code" after an intentional fix. Use that instruction; don't re-litigate it by asking again.
   - **Nobody has said which side is authoritative.** Flag the specific discrepancy — which fact, which sources, what each one actually says — and ask (per *Elicitation*, above). This is exactly the class of drift a referential-integrity validator cannot catch: every id can resolve and every edge type can be legal while the meaning has silently gone stale.
3. **New.** One source has something no other source, and no existing graph node, reflects at all. Treat it the same as any other fact with evidence behind it — apply the relevant calibration and confidence-gate it.

Cite real evidence for "match," not a vague impression — where you actually looked, a file, a function, a specific line in a document, a specific thing the person said. "Looks fine" is a guess dressed up as a finding.

---

## Writing it

Once a fact has cleared *Confidence-gating* (and *Cross-source reconciliation*, if more than one source was involved):

1. **Check for a duplicate before writing anything new.** Run `traverspec list [--type <type>]` — it returns one line per existing node (`id  [type]  Title — description`), so scan it for the id you're about to create. Don't create a second `data_model:User` because the check didn't happen first.
2. **Write edges at the same time as the node, never a deferred pass.** The moment you're converting evidence into structure is exactly the moment relationships get lost if you don't deliberately extract them — a real, detailed spec has been lost this way before: every relationship fact was present in the source prose, and none of it made it into the graph's structured fields, not because the schema was wrong but because writing structured relationships is easy to skip when moving fast. For every node, actively listen for what it touches — "this creates an order," "this checks the discount rules" — and write those edges now, not in a pass you might not get to.
3. **If what a fact depends on doesn't exist in the graph yet, say so.** That's often the moment to either author the missing piece too, or explicitly note it as something to come back to — don't leave a dangling reference unflagged.
4. **Apply the shared-`data_model` dependency test once the batch is done** (per the loop's step 2 — the whole document, the whole slice, or immediately if the batch is just this one fact) when a node in it touches a `data_model` other nodes already touch. Sharing a model doesn't by itself imply order — only write `depends_on` when one node's own content states a fact that only holds once a specific value or record already exists, and a different node's content is what makes that fact true. For code, this is usually cheap to resolve immediately rather than waiting — "who else writes this field" is often a direct grep, not something that requires holding the whole slice in memory; defer it only if that's genuinely not the case here.
5. **Check once more before presenting results** — confirm nothing you just added duplicates something under a different name.
6. **Run `traverspec validate`** if it's available, and fix anything it reports before calling the batch written. Note it checks structure only — a clean pass doesn't substitute for the confidence-gating judgment above.
7. **Summarize for the person once the batch is done, in separate groups, not one undifferentiated list.** What was written at high confidence; what's flagged as low-confidence or "found in code, unclear if intentional" and needs their call; and, if reconciliation happened, what drift was found and which side needed a decision. If the batch was a single ambient fact, this is just a short line — what was found and what was written — not a multi-group report; the scope of the summary always matches the scope of the batch. Don't bury flagged items inside a wall of otherwise-confident output — call them out as their own list.

---

## What this does not do

It does not mean every function, file, or code-derived detail becomes a node — granularity judgment still applies, anchored to entry points for code the same way it's anchored to document sections for prose. It does not mean code is trusted as a reliable narrator of intent just because it's a reliable narrator of behavior — those are different questions, and conflating them is the main way a code-derived graph goes wrong.
