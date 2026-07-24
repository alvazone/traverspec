# Reconciling Spec Against Code

This file is for checking whether the spec still describes what the code actually does. Not deriving new nodes from an unmapped codebase — that's `derive_spec_from_code.md`. Not implementing a feature — that's `traversal_policy.md`. This is specifically about verifying existing nodes against existing code, on demand.

This assumes you've already read `structure_reference.md` and `traversal_policy.md`. It also depends directly on `derive_spec_from_code.md`'s "Reconciling against existing nodes" section for the actual match/drift/new sorting — that logic isn't repeated here, read it there.

---

## When this gets used

- The person explicitly asks you to reconcile, check, or verify the spec against the code.
- It's a good moment to check on your own, most naturally at the start of a session, before adding new work on top of whatever's already there.
- If this project has run `traverspec add-hooks cursor` or `traverspec add-hooks claude`, you may also be prompted or blocked here automatically, right after editing code and before finishing a turn, naming the specific files that changed. That's opt-in per project, not every project has it configured, and it only ever tells you to come check, it never verifies anything on its own.
- Beyond that one opt-in mechanism, TraverSpec has no built-in way to detect when this is due — see the README's "Known limitations." Absent an explicit ask or that hook firing, running this is still a deliberate choice, yours or the person's.

---

## Get the scope, don't invent it

**If you were routed here from a stated task** — the person asked you to check something, or named a feature — resolve the entry point the same way `traversal_policy.md`'s Step 1 already describes, then run `traverspec show <entry-point>` (or the manual traversal if the CLI isn't available) to get the bounded set of nodes actually connected to it.

**If you were routed here by the `add-hooks` nudge instead,** you have a list of changed files, not a stated task or an entry point. There's no mapping from files to nodes anywhere in this project. Use `traverspec list` (or read `graph.yaml` directly) and look for node names or ids that plausibly relate to the files named, a changed `user.service.ts` is worth checking against `data_model:User` or any feature with "user" in it. If something clearly matches, resolve it as the entry point and proceed as above. If nothing obviously matches, don't guess, and don't fall back to reconciling the whole graph either, say plainly that the changed files didn't map cleanly to anything in the graph, and ask the person which part of the spec they relate to.

Either way, don't reconcile the whole graph at once — same reasoning `derive_spec_from_code.md` already gives for not boiling the ocean: a narrower pass means fewer places for a mistake to hide, and a smaller, checkable batch for the person to confirm.

---

## Work through it one node at a time

For each node in scope, read its actual content, whatever shape it happens to be written in, and compare it against the real code. Sort what you find using exactly the match, drift, or new outcomes `derive_spec_from_code.md`'s "Reconciling against existing nodes" section already defines. Don't restate that logic here, use it directly.

Do this one node at a time, not as a single pass over everything at once. A node's status is a small, bounded question, does this still hold, and treating it that way keeps you from losing track partway through a large scope.

---

## Cite real evidence, not a vague impression

For every node marked match, say where you actually looked, a file, a function, a test name. "Checked, looks fine" isn't a finding, it's a guess dressed up as one. This matters more here than almost anywhere else in these skill files, because reconciliation exists specifically to catch cases where something looks fine on the surface and isn't.

---

## Never silently resolve drift

Same rule as `derive_spec_from_code.md`: if the spec and the code disagree, don't quietly edit either one to match the other. The code might be a regression. The spec might be stale. Flag the specific discrepancy, name the node, the edge, or the section, and ask which side is authoritative.

---

## Finish with a plain summary, nothing persisted

Report back: what matched, what drifted and how, what's new on either side, and, explicitly, what in scope was never reached if you didn't get through all of it. That last part matters — an honest "didn't get to these" is worth more than silence that reads as "everything's fine."

This summary isn't written to its own file. Any real fix, a spec change or a code change, gets committed the normal way. The summary itself just gets reported to the person, in the conversation, a commit message, or a pull request description, wherever the work is actually happening.

---

## Custom rules

Add project-specific rules or exceptions for this skill below. Everything else in this file can be overwritten when `traverspec refresh-skills` pulls in a package update — content between these two markers never is.

<!-- traverspec:custom-rules:start -->
(No custom rules yet for this project.)
<!-- traverspec:custom-rules:end -->
