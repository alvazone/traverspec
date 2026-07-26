---
name: traverspec-read
description: Gather exactly the graph context needed to implement, modify, or explain existing code or behavior, or to reason about the impact of a change. Use for tasks like "implement checkout," "how does the refund flow work," "why does X fail," or "what breaks if I change Y" — not for writing new spec content and not for auditing whether the spec still matches the code.
---

# Read the Graph

This file is for gathering the exact context needed to implement, modify, or explain something that already exists, or to reason about the impact of a change. It is not for writing new spec content — that's `traverspec-write`. It is not for a deliberate check of whether the spec still matches the code — that's `reconcile`.

Load [references/structure_reference.md](references/structure_reference.md) and [references/traversal_policy.md](references/traversal_policy.md) before doing anything else, if you haven't already this session. The first defines what a node and an edge actually mean once you have one in front of you; the second tells you how to gather exactly the right set of them — no more, no less.

---

## The flow

1. **Resolve the entry point.** Per `references/traversal_policy.md`'s "Resolve the entry point" — match the task's wording against `traverspec list`'s output, and work through disambiguation if more than one node matches.
2. **Decide direction, and run `traverspec show`.** Per `references/traversal_policy.md`'s "Deciding direction" and "Reading the result" — forward for implement/explain, reverse for impact-analysis, both if genuinely uncertain.
3. **Load the actual content of every node the result returns — its `traverspec/assets/<type>/<name>.md` file, per `structure_reference.md` §6.** `show` only tells you which nodes are structurally connected, not what they say — that step doesn't go away. Use `references/traversal_policy.md`'s "Reading priority" table to decide how closely to read each one.
4. **Do the actual task** — implement the code, answer the question, or state the impact — using the context you just gathered. Nothing in `references/traversal_policy.md` covers this step; it only covers gathering the right context, not what to do with it.

---

## If something looks off while you're in here

Gathering context sometimes surfaces a mismatch — a node claims something the code no longer does, or the code does something no node or edge reflects. Noticing this is not the same as auditing for it: don't turn a read task into an unscoped reconciliation sweep. Say what you noticed, specifically, rather than silently building on top of content you suspect is wrong. If it's a new fact the conversation just settled, standing rule 3 already covers proposing a spec update for it. If it's broader drift that needs a real audit, that's `reconcile`'s job, not something to absorb into this task.

---

## What this does not do

It does not write anything to the graph — if the task also requires updating the spec, that's a separate pass with `traverspec-write`, not something this file does as a side effect of reading. It does not perform a deliberate, scoped reconciliation sweep — that's `reconcile`. It does not define what a node or edge means, or compute the traversal itself — both of those are `references/structure_reference.md` and `references/traversal_policy.md`, respectively; this file is the thin layer that sequences them for a read task.
