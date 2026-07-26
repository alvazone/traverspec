---
name: traverspec-reconcile
description: Compares existing spec nodes (features, data models, business rules, api_contracts, decisions) against the code they describe, sorting findings into match/drift/new and flagging any discrepancy for a human decision rather than assuming either side is correct. Use when the user asks to reconcile, check, or verify the spec against the code, as a start-of-session habit before adding new work, or after code changes when specific spec nodes need re-checking. Not for deriving new nodes from unmapped code — that's `traverspec-write`.
---

# Reconciling Spec Against Code

This file is for checking whether the spec still describes what the code actually does. Not deriving new nodes from an unmapped codebase, and not authoring anything new — that's `traverspec-write`. Not gathering context to implement a feature — that's `traverspec-read`. This is specifically about verifying existing nodes against existing code, on demand.

Load [references/structure_reference.md](references/structure_reference.md) and [references/traversal_policy.md](references/traversal_policy.md) before doing anything else, if you haven't already this session — the first defines what a node's content should look like, the second tells you how to resolve an entry point and scope a `show` result.

---

## When this gets used

- The person explicitly asks you to reconcile, check, or verify the spec against the code.
- It's a good moment to check on your own, most naturally at the start of a session, before adding new work on top of whatever's already there.
- If this project has run `traverspec add-hooks cursor` or `traverspec add-hooks claude`, you may also be prompted or blocked here automatically, right after editing code and before finishing a turn, naming the specific files that changed. That's opt-in per project, not every project has it configured, and it only ever tells you to come check, it never verifies anything on its own.
- Beyond that one opt-in mechanism, TraverSpec has no built-in way to detect when this is due: large result sets and coupling aside, nothing watches the codebase for drift by default. Absent an explicit ask or that hook firing, running this is still a deliberate choice, yours or the person's.

---

## Get the scope, don't invent it

**If you were routed here from a stated task** — the person asked you to check something, or named a feature — resolve the entry point per `references/traversal_policy.md`'s "Resolve the entry point," then run `traverspec show <entry-point>` to get the bounded set of nodes actually connected to it.

**If you were routed here by the `add-hooks` nudge instead,** you have a list of changed files, not a stated task or an entry point. There's no mapping from files to nodes anywhere in this project. Use `traverspec list` and look for node names or ids that plausibly relate to the files named — a changed `user.service.ts` is worth checking against `data_model:User` or any feature with "user" in it. If something clearly matches, resolve it as the entry point and proceed as above. If nothing obviously matches, don't guess, and don't fall back to reconciling the whole graph either — say plainly that the changed files didn't map cleanly to anything in the graph, and ask the person which part of the spec they relate to.

Either way, don't reconcile the whole graph at once — a narrower pass means fewer places for a mistake to hide, and a smaller, checkable batch for the person to confirm.

---

## Work through it one node at a time

For each node in scope, read its actual content (its `traverspec/assets/<type>/<name>.md` file, per `structure_reference.md` §6) and compare it against the real code. Sort what you find into exactly one of three outcomes:

1. **Match.** No action.
2. **Drift.** The graph and the code disagree — an edge exists but the code no longer does that, or the code does something no edge or content section reflects. **Do not silently resolve this either direction.** Don't quietly edit the graph to match the code (the code might be the regression), and don't assume the graph is right and the code is wrong (the code might have evolved correctly and the spec is stale). Flag it as a specific, named discrepancy — which node, which edge or section, what the code actually does — and ask which side is authoritative. This is exactly the class of drift a referential-integrity validator cannot catch: every id can resolve and every edge type can be legal while the meaning has silently gone stale.
3. **New.** The code does something with no corresponding node or edge at all. This is a `traverspec-write` task, not a reconcile task — hand it off there, using `traverspec-write`'s code-evidence confidence tiers, rather than authoring it inline here.

Do this one node at a time, not as a single pass over everything at once. A node's status is a small, bounded question — does this still hold — and treating it that way keeps you from losing track partway through a large scope.

---

## Cite real evidence, not a vague impression

For every node marked match, say where you actually looked — a file, a function, a test name. "Checked, looks fine" isn't a finding, it's a guess dressed up as one. This matters more here than almost anywhere else in these skill files, because reconciliation exists specifically to catch cases where something looks fine on the surface and isn't.

---

## Finish with a plain summary, nothing persisted

Report back: what matched, what drifted and how, what's new on either side, and, explicitly, what in scope was never reached if you didn't get through all of it. That last part matters — an honest "didn't get to these" is worth more than silence that reads as "everything's fine."

This summary isn't written to its own file. Any real fix — a spec change or a code change — gets committed the normal way. The summary itself just gets reported to the person, in the conversation, a commit message, or a pull request description, wherever the work is actually happening.
