# Traversal Policy

This file explains how to gather context from the spec graph for a task — implementing something, explaining how something works, or reasoning about the impact of a change. It assumes you already know what nodes and edges are; if not, read `structure_reference.md` first.

The goal of traversal is to load exactly the nodes relevant to the task — not the whole graph, not just the one node the task names. Follow these rules in order.

---

## Step 0 — Load `constitution.md` unconditionally

Before resolving an entry point or following any edge, read `traverspec/constitution.md` if it exists. This file holds standing, project-wide rules (e.g. "all endpoints require auth") that apply regardless of what you're working on. It is not a node, it has no edges, and nothing in `traverspec/graph.yaml` points to it — you load it every time, as a fixed first step, not because traversal led you there.

If `traverspec/constitution.md` doesn't exist, skip this step and continue. Its absence is not an error.

---

## Step 1 — Resolve the entry point

Figure out which node the task is actually about, and enter the graph there. Entry points are resolved directly — by matching the task against node names and ids in `traverspec/graph.yaml` — not by starting at an epic and working your way in.

- "Implement checkout" → entry point is `feature:checkout`.
- "Why does the refund endpoint fail on weekends" → entry point is the relevant `api_contract` node.
- "What breaks if I change the User table" → entry point is `data_model:User`. **This phrasing is an impact-analysis question, not an implement/explain question — it resolves to the same entry point but traverses in the opposite direction. See the second exception in Step 3.**

Any node type can be an entry point. There is no requirement to resolve through an `epic` first, even if the task mentions one — epics are for filtering, not for gating access to the rest of the graph (see `structure_reference.md`, Section 4).

If nothing in `traverspec/graph.yaml` matches what the task is describing, say so — don't guess at the nearest-sounding node and proceed as if it were confirmed.

### When more than one node matches

A single word like "checkout" can match several nodes at once — `feature:checkout` and `api_contract:POST-orders-checkout` might both be real, valid matches. Don't just pick one arbitrarily; resolve it deliberately:

1. **Let the task's own wording disambiguate first.** "Implement checkout" or "how does checkout work" is asking about the capability — enter at the `feature`. "Why does the checkout endpoint return a 500" or "POST /orders/checkout is slow" is asking about the specific operation — enter at the `api_contract`. The words the person actually used usually point at one or the other.

2. **If the wording doesn't disambiguate, prefer the broader node — usually the `feature`.** This isn't an arbitrary type-priority ranking; it's because a `feature` node's forward traversal will reach its related `api_contract` anyway (via a `triggers` edge), so entering at the feature loses nothing. Entering at the `api_contract` instead risks the opposite problem: contracts rarely have their own outgoing `depends_on`/`mutates`/`reads` edges, so starting there can strand you with a nearly empty traversal that misses the feature's behavior, acceptance criteria, and data relationships entirely.

3. **If it's still genuinely unclear** — for example, no `feature` node exists at all, or two equally-specific nodes match with no textual cue pointing at either — don't default silently. Ask which one the person means, same as you would if nothing matched at all.

---

## Step 2 — Follow forward edges, exhaustively, with no depth limit

From the entry point, follow every outgoing edge of these types: `depends_on`, `mutates`, `reads`, `triggers`, `enforces`, `foreign_key`, `calls`, `dispatches`. Load each node you reach this way, then repeat from that node — follow its forward edges too, and so on.

**There is no cap on how many hops deep this goes.** Depth is not a measure of relevance. A dependency chain that is five edges deep is not "less relevant" than one that is one edge deep — if it's reachable by a forward edge, it's part of the context this task needs, however far away it sits. Stopping early because a chain seems "too deep" risks silently omitting something the task actually depends on. The chain terminates naturally when a node has no further forward edges to follow — not when you decide it's gone far enough.

---

## Step 3 — Never follow reverse edges, with two exceptions

When you load a node, do not also look at what points *at* it — only what it points *to*. This is what keeps traversal from exploding outward through shared, high-traffic nodes.

Concretely: if your traversal reaches `data_model:User` (because `feature:checkout` reads it), do not then go looking for every other feature that also reads `User`. Those other features are unrelated to the current task even though they happen to touch the same data. Loading them would mean two unrelated tasks — one on checkout, one on login — end up pulling nearly identical, mostly-irrelevant context, just because they share one common node.

**The first exception is `overrides`.** For every node you load, check whether any `decision` node has an `overrides` edge pointing at it — this is a reverse check, done deliberately, every time. If you find one, load that `decision` node too, even though you reached the target by a reverse path.

This exception exists because an `overrides` edge changes the meaning of the node it points at. A `business_rule` that says "email must be unique" is not the full picture if a `decision` node exists saying "except for legacy-merged accounts." Skipping that check isn't a minor inefficiency — it produces a wrong understanding of the rule, not just an incomplete one. Every other reverse relationship is irrelevant-by-default; this one is corrective-by-default, and correctness beats economy here.

**The second exception is impact-analysis questions** — "what breaks if I change X," "what depends on X," "what would removing X affect." Everything above (Steps 1–3) assumes the task is *implementing or explaining* the entry point, where forward edges are exactly what's needed and reverse edges are noise. Impact analysis inverts that: the person is asking what points *at* the entry point, which is precisely the reverse direction.

When the task's own wording is this shape, do not forward-traverse from the entry point at all — forward traversal answers "what does this node need," and that isn't the question. Instead, find every node with an edge of the traversal-participant types (`depends_on`, `mutates`, `reads`, `triggers`, `enforces`, `foreign_key`, `calls`, `dispatches`) pointing *into* the entry point, and load each one directly. This is a single reverse hop, not a recursive reverse walk — report the direct dependents (what would break), not the dependents of the dependents. If the task genuinely needs the second-order blast radius, that's a separate, explicit follow-up traversal from one of those dependents as a new entry point, not an automatic cascade.

Without this exception, a question like "what breaks if I change `data_model:User`" is unanswerable: `User` typically has no outgoing edges of its own, so forward traversal terminates immediately with nothing loaded, even though many other nodes may hold foreign keys into it or read/mutate it directly.

---

## Step 4 — Track visited nodes to handle cycles

Keep a running set of every node id you've already loaded during this traversal. Before loading any node — including ones reached via the `overrides` check in Step 3 — check whether its id is already in that set. If it is, skip it: don't reload it, and don't re-follow its edges again.

This matters because the graph can legitimately contain cycles — `feature:checkout` might `depend_on` `feature:apply_discount_code`, which might in turn `depend_on` `feature:checkout`. Without tracking visited nodes, this loops forever. With it, the traversal simply terminates the second time it would revisit a node, and nothing is lost — you already have that node's content from the first visit.

---

## Worked example

Given:
```
feature:checkout
  --depends_on--> feature:apply_discount_code
  --mutates--> data_model:Order
  --reads--> data_model:User
  --triggers--> api_contract:POST-orders-checkout

feature:apply_discount_code
  --reads--> data_model:DiscountCode
  --enforces--> business_rule:BR-0014-discount-stacking

feature:login
  --reads--> data_model:User

decision:DC-0014-legacy-duplicate-emails
  --overrides--> business_rule:BR-0002-unique-email

feature:signup
  --mutates--> data_model:User
  --enforces--> business_rule:BR-0002-unique-email
```

**Task: "implement checkout."** Entry point: `feature:checkout` — not `api_contract:POST-orders-checkout`, even though both match the word "checkout" (see the entry-point resolution rule in Step 1: the wording points at the capability, and the feature reaches the contract anyway via `triggers`). Forward traversal loads: `apply_discount_code`, `Order`, `User`, `POST-orders-checkout`, `DiscountCode`, `BR-0014-discount-stacking`. It does **not** load `feature:login`, even though `login` also reads `User` — that's a reverse relationship relative to how this traversal reached `User`, and irrelevant to implementing checkout.

**Task: "implement signup."** Entry point: `feature:signup`. Forward traversal loads: `User`, `BR-0002-unique-email`. The Step 3 override check then fires on `BR-0002-unique-email` and also loads `decision:DC-0014-legacy-duplicate-emails` — without this, an agent implementing signup would enforce strict uniqueness and break legacy accounts that are supposed to be exempt.

**Task: "what breaks if I change the User table."** Entry point: `data_model:User` — same node as above, but the wording marks this as impact analysis, not implementation. Forward traversal from `User` finds nothing (it has no outgoing edges), so instead: find every edge pointing *into* `User` and load its source directly. That's `feature:checkout` (reads), `feature:login` (reads), and `feature:signup` (mutates) — three direct dependents, loaded one hop back, with no further traversal from any of them.

---

## What this policy deliberately does not do

It does not cap traversal by hop count. It does not fragment the graph into separate per-epic subgraphs to control scope. Both were considered and rejected — direction (forward-only for implement/explain tasks, reversed for impact-analysis tasks, plus the `overrides` check on every loaded node) does the job of keeping traversal scoped to what's relevant, without either of those tradeoffs. If traversal from a reasonable entry point is pulling in content that feels irrelevant, the likely cause is a miscategorized edge (something marked `depends_on` that shouldn't be), not a missing depth cap — fix the edge, don't work around it by truncating traversal.

---

## Custom rules

Add project-specific rules or exceptions for this skill below. Everything else in this file can be overwritten when `traverspec refresh-skills` pulls in a package update — content between these two markers never is.

<!-- traverspec:custom-rules:start -->
(No custom rules yet for this project.)
<!-- traverspec:custom-rules:end -->
