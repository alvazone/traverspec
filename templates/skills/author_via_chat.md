# Authoring Specs Through Conversation

This file is for when someone wants to build out a spec by talking it through with you, rather than handing you an existing document. There's no source material to convert — the information only exists in their head, and your job is to draw it out and structure it as you go.

This assumes you've already read `structure_reference.md`. This file is about how to run the conversation; that file is still what defines what a valid node looks like once you're ready to write one.

---

## The core difference from ingestion

`ingest_spec.md` is about extracting structure from something that already fully exists in text. This is about **helping someone think through something that may not be fully formed yet.** They might not know yet whether what they're describing is one feature or three, or what the exact data fields should be called. Your job includes some of the thinking, not just the structuring.

This means the failure mode here is different from ingestion's. In ingestion, the risk is misreading something that was already stated clearly. Here, the risk is **writing down a node before the person has actually decided what they mean** — capturing their first-draft thought as if it were settled, when a bit more conversation would have sharpened it into something better.

---

## General approach: converge, don't interrogate

Don't run through a rigid checklist of questions for every node type. Ask what's actually needed to move from "I have an idea" to "this is a clear, specific spec," and stop once you have that — not once you've exhausted a list.

A useful test before asking a question: **would the answer change what you write, or just add detail you'd write anyway?** If a question wouldn't change the resulting spec, skip it. If you already know the answer from earlier in the conversation, don't ask again.

Ask one thing at a time where possible. A wall of five questions up front is worse than one well-chosen question, a written response, and a natural follow-up — this mirrors how the person actually thinks through a new idea, rather than forcing them to pre-answer things out of order.

---

## What to draw out, by node type

These aren't scripts — they're the *kind* of gap you're listening for per node type, so you know what's still missing.

**feature** — What does this actually do, and who or what triggers it? What should explicitly NOT happen (scope boundaries are often clearer once stated than left implicit)? What would prove it's working correctly — this feeds the Acceptance Criteria section directly, so ask for concrete, checkable conditions, not vague ones.

**data_model** — What fields does this actually need, and which are required vs. optional? Does this reference or depend on anything else that already exists in the graph — check `traverspec/graph.yaml` (or `traverspec list` if the CLI is available), then ask about anything that seems like it should connect but doesn't yet.

**api_contract** — What's the exact trigger — method, path, or operation name? What does success return, and what should fail conditions look like? People often describe the happy path fluently but skip errors — explicitly prompt for what should happen when it doesn't work, since that section is easy to leave thin otherwise.

**business_rule** — Is this actually a standalone rule, or is it really just detail belonging inside one feature? If it only ever applies to one feature and nothing else references it, it may not need to be its own node — ask, rather than defaulting to creating one.

**decision** — Decisions surface differently than other nodes — usually mid-conversation, as an aside ("oh, but that's not true for legacy accounts"), not as something someone sets out to author directly. When you notice this shape of statement, pause the main thread and capture it properly: what's the exception, what does it override, and why. Don't let it pass as a one-line note buried inside whatever node you were working on when it came up — it needs its own node with an explicit `overrides` edge, or it will get lost the same way it would in an ordinary doc.

---

## When to stop and write

Write the node once you can fill in its schema (per `structure_reference.md`) without inventing anything the person hasn't actually told you. If you notice yourself about to fill in a plausible-sounding detail they never stated, that's the signal to ask instead of proceeding — not because the guess is necessarily wrong, but because it's not yet theirs.

After writing a node, briefly reflect back what you wrote and ask if it's right — not as a formality, but because converting a conversation into structured prose sometimes reveals a gap or a wrong assumption that wasn't obvious mid-conversation. This is cheaper to catch now than after several more nodes have been built on top of it.

---

## Edges are part of authoring, not an afterthought

The same discipline from `ingest_spec.md` applies here: don't treat writing the edges as a separate, optional step after the node is done. As the person describes a new feature, actively listen for what it touches — "this creates an order," "this checks the discount rules" — and write those edges at the same time as the node. If what they're describing clearly depends on or affects something that doesn't exist in the graph yet, say so — that's often the moment to either author that missing piece too, or explicitly note it as something to come back to.

While you're at it, check the new feature's `mutates`/`reads`/`foreign_key` edges against `traverspec/graph.yaml` for other features already touching the same `data_model` — the graph built through conversation stays small, so this is cheap to do node by node rather than saving it for a final sweep. Apply the test in `structure_reference.md` §3a to decide whether that implies a real `depends_on`, or whether the two are just independent peers on the same model (most of the time, they are).

---

## Before finishing

Same as ingestion: check `traverspec/graph.yaml` (or `traverspec list` if the CLI is available) before creating anything (per `start_here.md`), and don't create a second node for something that already exists under a slightly different name — if what the person is describing sounds close to something already in the graph, surface that rather than assuming it's new. Run `traverspec validate` if it's available before considering the node finished, same as `start_here.md` describes — fix anything it reports rather than leaving it for later.

---

## Custom rules

Add project-specific rules or exceptions for this skill below. Everything else in this file can be overwritten when `traverspec refresh-skills` pulls in a package update — content between these two markers never is.

<!-- traverspec:custom-rules:start -->
(No custom rules yet for this project.)
<!-- traverspec:custom-rules:end -->
