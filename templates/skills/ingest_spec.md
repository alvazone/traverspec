# Ingesting an Existing Spec

This file is for when you've been given an existing document — a PDF, a Word doc, pasted text, a Notion export, notes, anything — and asked to convert it into this project's spec graph.

This assumes you've already read `structure_reference.md`. Everything you write here — node types, edge types, file schema, naming — follows those rules exactly. This file adds one thing on top: how to handle the judgment calls that come from converting someone else's prose into a structured graph.

---

## The core risk this file exists to manage

A real spec document almost always contains two kinds of information, mixed together without labeling which is which:

1. Facts that map cleanly onto a node or an edge — "the checkout feature creates an Order record" is unambiguously a `mutates` edge from `feature:checkout` to `data_model:Order`.
2. Facts that are true and important, but ambiguous in how they should be structured — where exactly one feature ends and another begins, whether something is a `business_rule` or just incidental detail inside a `feature`, whether two similarly-named things are actually the same node or two different ones.

The failure mode to guard against is not "missing something" — it's **confidently structuring an ambiguous fact as if it were a clean one.** Two different agents converting the same document should not produce meaningfully different graphs. When they would, that's exactly the moment to stop and ask instead of picking one interpretation silently.

---

## Confidence-gated behavior

For every piece of content you're about to convert into a node, an edge, or a section of a node, judge your own confidence honestly before writing anything.

**High confidence — write it directly.** Use this when the source document states something explicitly and unambiguously, in a form that maps onto exactly one node type or edge type with no real alternative reading. Examples: a clearly labeled data model table with field names and types; a sentence stating "X creates a Y record"; an endpoint with an explicit HTTP method and path.

**Low confidence — stop and ask, don't guess-and-assert.** Use this when any of the following are true:
- The document describes something that could reasonably be split into more than one node, or merged into fewer, and the right granularity isn't obvious (see `structure_reference.md` Section 2a for the granularity test — apply the same judgment here, but flag it rather than deciding silently).
- A relationship is implied but not stated — e.g. the document mentions two entities in the same paragraph without saying how they relate. Do not infer an edge type from proximity in the text.
- Something could plausibly be a `business_rule` or could just be incidental prose inside a `feature`, and the document's own structure doesn't make it clear which the author intended.
- You would need to invent a name, an id, or a categorization that isn't present anywhere in the source text.

When you hit a low-confidence case, don't pick the most-likely-sounding interpretation and move on. Surface the specific ambiguity to the person and ask — a short, specific question, not a general "does this look right?" Then continue with the rest of the document while that's pending, rather than blocking the entire ingestion on one unclear section.

---

## Why this matters more than it might seem

This isn't a hypothetical concern. A real, detailed, well-organized spec was reviewed during this project's design process — one with a schema built specifically to hold structured relationships between entities and features. Every relevant relationship fact was actually present in the document's prose, in detail. None of it had been captured in the structured fields meant to hold it — not because the schema was wrong, but because writing structured relationships takes deliberate effort that's easy to skip when moving fast through real content.

The lesson from that isn't "be more careful" as a vague instruction — it's specific: **the moment you're converting prose into structure is exactly the moment relationships get lost if you don't deliberately extract them.** It is not enough to convert the obvious nodes (a feature here, a data model there) and leave relationships as an afterthought. For every node you create from source material, explicitly ask yourself what it reads, mutates, triggers, or enforces according to the text — and write those edges at the same time you write the node, not in a separate pass you might not get to.

---

## Practical sequence for a full document

1. Read the whole document first. Don't start writing nodes on the first pass — you need to see the overall shape before deciding where the boundaries are.
2. Identify likely `epic` groupings, if the document has natural top-level sections. This is low-stakes to get slightly wrong since epics are just labels, not structural commitments.
3. Work through the document's own structure, converting each section into the node type it most resembles per `structure_reference.md`. Apply the confidence gate from above at each step.
4. For every node written, before moving to the next section, look back at what you just wrote and ask: does this reference, use, create, or constrain anything else in this document? If yes, that's an edge — write it now, using the correct type from `structure_reference.md` Section 3. Don't defer this to a "pass two" that may not happen.
5. Before presenting the result, check `traverspec/graph.yaml` (per the rule in `start_here.md`) to confirm you haven't created a duplicate of something that already existed before this ingestion started, and run `traverspec validate` if it's available (per `start_here.md`) — fix anything it reports before moving on.
6. Summarize for the person: what was written at high confidence, and the specific list of low-confidence items you need their input on. Don't bury the low-confidence flags inside a wall of otherwise-confident output — call them out clearly as a separate list.

---

## What this file does not do

This file does not lower the bar for what counts as a valid node or edge — everything you produce still has to conform exactly to `structure_reference.md`. Confidence-gating governs *whether you write something now or ask first*, not *what the rules are once you do write it*.
