# Deriving a Spec from Code

This file is for when the source of truth is an existing codebase, not a document and not a conversation — you've been pointed at real code (a repo, a module, a set of files) and asked to produce or update the spec graph from what it actually does.

This assumes you've already read `structure_reference.md`. Everything you write here still has to conform exactly to that schema. This file adds what's specific to reading code as the source: a different confidence problem than ingestion has, and a fork depending on whether the graph already covers the area you're reading.

---

## First: are you generating or reconciling?

Per `start_here.md`'s standing rule, check `traverspec/graph.yaml` before writing anything. That check tells you which mode you're in for the area of code you're looking at:

- **No existing nodes cover this code** → you're generating from scratch. Go to "Generating from scratch" below.
- **Nodes already exist for this area** → you're reconciling — checking whether the graph still matches what the code actually does. Go to "Reconciling against existing nodes" below.

A single session can be in both modes at once for different parts of the same codebase — check per area, not once for the whole task.

---

## Scope the first pass — don't boil the ocean

`ingest_spec.md` can reasonably say "read the whole document first" because a document has a bounded size you can hold in view before converting anything. A codebase doesn't — there is no equivalent full read before you start. Don't try to derive the whole graph from an entire repo in one pass.

Pick one vertical slice first — one feature end-to-end, or one epic's worth of entry points (auth is a common starting choice, since it's usually self-contained) — and take it from entry point through to data and business logic before moving to the next slice. This isn't just about managing effort: a narrower first pass means fewer places for the core risk below (canonizing a bug as a rule) to hide undetected, and gives the person a smaller, checkable batch to confirm before you continue into the rest of the codebase.

---

## The core risk this file exists to manage

`ingest_spec.md`'s risk is confidently structuring an *ambiguous* prose fact. This file's risk is different and sharper: **confusing what the code happens to do with what the system is supposed to do.** Code is executable ground truth for mechanism — it doesn't lie about what runs. It says nothing reliable about intent. A validation branch, a hardcoded limit, an odd sequencing of two calls: each of these could be a deliberate business rule, or could be a bug, a workaround, dead code nobody has removed, or an accident of whoever wrote it being in a hurry. Code cannot tell you which.

Getting this wrong is worse here than in ingestion. A misread prose fact is a wrong edge. A misread code artifact canonized as a `business_rule` or `decision` means the spec now asserts a bug is intentional — the next person or agent to read the graph will treat it as correct, build on top of it, and may propagate it elsewhere specifically *because* the spec told them to.

---

## Confidence-gating, specific to code

**High confidence — write it directly.** Structural, shape-level facts that are unambiguous regardless of intent: a DB column's name/type/nullability, an explicit foreign key constraint, a route's path and HTTP method, a request/response shape defined by a type or serializer. These map onto `data_model` fields and `api_contract` request/response sections the same way a clearly-labeled table in a document would.

A `data_model`'s Constraints column isn't fully covered by the schema/ORM file alone, though. Application-layer constraints — length bounds, format checks, allowed-value ranges — routinely exist only in a separate validation/parsing file, precisely because the database doesn't need to enforce them to function. Checking only the schema for a data_model's constraints will systematically miss these. For every field, check whether the entity has a corresponding validation file (`<module>.validation.ts`, a Zod/Joi schema, a serializer) before treating the Constraints column as complete.

**Real, but missing half the schema — write what you can, then ask.** Business logic that is demonstrably, consistently enforced (a validation rule applied across every code path that touches an entity, backed by a test asserting it) is high confidence for the `business_rule` node's **Statement** — the code proves the rule holds. It tells you nothing for **Rationale** — code doesn't explain why, only what. Write the Statement, leave Rationale flagged as unknown, and ask rather than inventing a plausible-sounding justification. A fabricated rationale is worse than a missing one: a missing one is visibly incomplete, a fabricated one looks authoritative and isn't.

A test asserting the behavior strengthens confidence in the **Statement** — someone cared enough to pin the behavior down. It still isn't Rationale, even when the test exists. The only thing that counts as Rationale evidence is an explicit statement of *why* — a comment, a test description, a commit message — not the mere presence of a test or the behavior's consistency. Consistency tells you the rule is real; only a stated reason tells you why it exists.

**Low confidence — stop and flag, don't canonize.** Anything that could plausibly be unintentional: logic with no test coverage, a check that only fires on one of several structurally similar code paths (inconsistency is a signal, not a rule), anything that reads like a workaround, or behavior that contradicts what a related node already states elsewhere in the graph. Surface these explicitly as "found in code, unclear if intentional" and ask before writing a `business_rule` or `decision` node for them. This is the code equivalent of `ingest_spec.md`'s low-confidence gate, but the trigger condition is different — there it's ambiguous *wording*, here it's ambiguous *intent behind working code*. When you're following up on a flagged item, switch into `author_via_chat.md`'s style for that exchange — one question at a time, converge rather than interrogate — rather than batching every ambiguity into one long list of questions.

---

## Feature boundaries don't come from file boundaries

Code has no first-class concept of "feature" — it's organized by technical layer (controllers, services, models) or by module, and neither reliably lines up with a product capability. Don't assume one file or one module is one feature.

Instead, look for **entry points** — route handlers, command handlers, queue consumers, cron jobs — each one is a concrete way the feature gets invoked. Trace outward from an entry point (what it calls, reads, writes, and what it in turn causes) to scope the feature's boundary. A single feature will often span several files; a single shared utility file may be touched by many unrelated features and is not itself a feature. The granularity test from `structure_reference.md` Section 2a still applies — would anything ever need to reference this piece independently? — just apply it to code structures instead of document sections.

Epics have the same problem, one level up — a folder like `services/notifications/` is a technical grouping, not necessarily a product domain, and code layout rarely lines up with how the person actually thinks about their product's epics. Don't infer epic assignment from directory structure. Draft the features first, then either ask the person how they'd group them or leave epic assignment for a short follow-up conversation once a few features exist to group — getting this slightly wrong costs little (epics are a label, not a structural edge), so it's fine to defer rather than force a guess now.

---

## Mapping code facts to edge types

The same edge-type discipline from `structure_reference.md` Section 3 applies — pick the type that matches the actual relationship in the code, don't force-fit:

- **`mutates` / `reads`** — trace actual writes/reads (ORM calls, queries) from the entry point outward.
- **`triggers`** — the entry point's own route/handler mapping to its `api_contract`.
- **`dispatches`** — a literal enqueue call, event-bus publish, or scheduled/async task dispatch found in code (`queue.enqueue(...)`, `eventBus.emit(...)`, a cron registration). This is exactly the runtime-causality fact `ingest_spec.md`-style prose reading tends to miss and code makes explicit — don't skip recording it just because it's "just an implementation detail."
- **`foreign_key`** — an explicit FK constraint in a migration or schema definition.
- **`depends_on`** — one feature's entry point calling into logic another feature's entry point also relies on, or requiring another feature's data/state to exist first.
- **`enforces`** — a code path that implements a `business_rule` you've already written (or are writing now) with a confirmed Statement.

Write these at the same time you write the node, not as a deferred pass — same discipline as `ingest_spec.md` and `author_via_chat.md`, and the same failure mode (relationships get lost the moment you move on to the next file) if you don't.

---

## Generating from scratch

Follow the practical sequence from `ingest_spec.md` (read broadly first, then convert, checking `traverspec/graph.yaml` before writing), with code as the source and the confidence-gating rules above in place of that file's prose-specific ones — but "broadly" means within the scoped vertical slice from the section above, not the whole repo. Read that slice's entry points first to find feature boundaries, then trace outward into data and business logic.

Product-level framing — `traverspec/about.md`'s Problem/Solution/Goals/Non-Goals, `traverspec/constitution.md`'s operational standing rules — is not something code can tell you. Code shows you what was built, not what the product is for or what it deliberately chooses not to do. Don't attempt to reverse-engineer these from code structure or naming. On a greenfield install with no `about.md` content yet, either ask the person directly once the first vertical slice is drafted, or leave it empty and say so — an empty `traverspec/about.md` is a known, acceptable state per `start_here.md`, not a gap you need to fill by inference.

---

## Reconciling against existing nodes

When a node already exists for the code you're reading, the task changes from *creating* to *diffing*. For each existing node whose code you're examining, compare its content and edges against what the code actually does now, and sort what you find into exactly one of three outcomes:

1. **Match.** No action.
2. **Drift.** The graph and the code disagree — an edge exists but the code no longer does that, or the code does something no edge or content section reflects. **Do not silently resolve this either direction.** Don't quietly edit the graph to match the code (the code might be the regression), and don't assume the graph is right and the code is wrong (the code might have evolved correctly and the spec is stale). Flag it as a specific, named discrepancy — which node, which edge or section, what the code actually does — and ask which side is authoritative. This is exactly the class of drift a referential-integrity validator cannot catch: every id can resolve and every edge type can be legal while the meaning has silently gone stale.
3. **New.** The code does something with no corresponding node or edge at all. Treat it the same as the "generating from scratch" case, subject to the same confidence gates.

---

## Before finishing

Check `traverspec/graph.yaml` once more before presenting results, same as the other authoring skills — confirm nothing you're about to add duplicates something that already exists under a different name. Run `traverspec validate` if it's available (per `start_here.md`) and fix anything it reports — note that it checks structure only, so a clean pass doesn't substitute for the confidence-gating judgment above; it catches a malformed edge, not a canonized bug. Summarize for the person in three groups, not one undifferentiated list: what was written at high confidence, what's flagged as "found in code, unclear if intentional" and needs a human call, and — if you were reconciling — what drift was found and which side needs a decision.

---

## What this file does not do

It does not lower the schema bar — everything produced still has to conform to `structure_reference.md` exactly. It does not mean every function or file becomes a node — granularity judgment still applies, just anchored to entry points instead of document sections. And it does not mean code is trusted as a reliable narrator of intent just because it's a reliable narrator of behavior — those are two different questions, and this file exists specifically because conflating them is the main way a code-derived graph goes wrong.
