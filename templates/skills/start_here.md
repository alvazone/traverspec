# TraverSpec — Start Here

This project's specifications are not stored as flat documents. They live as a **graph**: small, single-concern markdown files (`traverspec/assets/`), with all relationships between them declared explicitly in one file (`traverspec/graph.yaml`).

You are reading this because you are about to do work in this project — writing code, answering a question about how something works, or authoring/updating a spec. This file tells you what to read next, and one rule that applies no matter what you're about to do.

If you have not read this file before in this session, read it fully before doing anything else project-related.

---

## Product orientation — read once per session

If `traverspec/about.md` exists and isn't empty, read it once per session, before routing by task below. It holds the product's Problem, Solution, Goals, and Non-Goals — background for understanding what this project is for and what it deliberately doesn't do.

This is different from `traverspec/constitution.md`, which `traversal_policy.md` loads unconditionally on *every* traversal because it holds enforceable, per-task operational rules (e.g. "all endpoints require auth"). `about.md` isn't a rule you check against — it's orientation you need once, most useful when deciding whether something belongs in the product at all (authoring a new spec, judging if a request matches a stated non-goal) rather than when implementing an already-specified feature. Don't re-read it if you've already read it this session, and don't treat its absence or emptiness as an error — same as `constitution.md`.

---

## Check whether the CLI is actually installed, once per session

`traverspec/` existing as a folder doesn't mean the `traverspec` command is available — check both separately, don't assume one implies the other. If the folder exists but the command doesn't, mention it to the person once this session: without the CLI, `list`, `show`, and `validate` all fall back to reading `graph.yaml` and its assets by hand for everything those commands would otherwise do mechanically and exhaustively, which is slower and easier to get wrong on anything but a small graph. Suggest installing it, `npm install --save-dev @alvazone/traverspec` if this looks like a Node project (a `package.json` exists at the root), or a global install otherwise, per the README. Say it once, then continue the session either way, with the manual fallback if it's still not available afterward — don't repeat the suggestion again later in the same session.

---

## Rules that always apply

Four things always apply here, no matter which task below you're routed to:

1. Check `graph.yaml` before creating any new node.
2. Verify before stating what a file, function, command, or graph entry contains — don't answer from memory.
3. Propose a spec update the moment a conversation settles something the spec should say.
4. Ask before editing `graph.yaml` or `assets/` — never assume a change is wanted.

Details on each below.

**Before creating any new node (feature, data_model, api_contract, business_rule, decision, epic, or optional types), check `traverspec/graph.yaml` first to see if it already exists.**

This is not optional and does not depend on which task below you're routed to. Creating a duplicate node — a second `data_model:User`, a second `feature:checkout` — silently fractures the graph: some edges will point at one copy, some at the other, and nothing will detect the split. If you're ever about to write a new asset file, your first action is always a check against `traverspec/graph.yaml`, not a search of your own memory of the conversation. If the `traverspec` CLI is available, `traverspec list` (optionally `--type <type>`) is the faster, more reliable way to do this check, see `traversal_policy.md`.

If something looks like it should exist but doesn't, that's fine — create it. This rule is about checking, not about hesitating.

**Before stating what any file, function, command, or graph entry actually contains or does, verify it in this session — read the file, run the command, or check `graph.yaml` — rather than answering from memory or assumption, even when you're confident you already know.** This applies everywhere, not only before creating a node: explaining how something works, answering a question about behavior, describing what a command does, making a claim mid-conversation. Confidence is not evidence. If you haven't opened it in this session, you don't know it yet, you're recalling it, and recall can be wrong or stale. Check first, then answer.

**If a conversation reaches a concluded, finalized change to what the spec should say, propose updating the spec before considering the task done.** This applies regardless of which task routed you here, not just when the task itself is spec authoring — implementation conversations settle real decisions too. A new business rule, a changed behavior, an exception someone just stated as decided rather than still being worked out, that's spec-worthy the moment it's settled, not something to leave for a future pass. Don't let it happen only in the routing case built for it (`author_via_chat.md`'s handling of decisions surfacing mid-conversation) — the same instinct applies everywhere.

Ask the person first; don't edit `traverspec/graph.yaml` or `assets/` on an assumption that a change is wanted. This is a separate gate from CODEOWNERS: CODEOWNERS (if configured, see the main README) controls whether an already-made edit can be merged, this is about whether the agent proposes making the edit at all. Getting a yes here doesn't bypass CODEOWNERS review, and CODEOWNERS review isn't a substitute for asking here.

---

## Validate after writing, if the tool is available

If this project has the `traverspec` CLI available — check for a `traverspec` command, or a `traverspec/` folder at the project root — run `traverspec validate` after writing or editing anything in `traverspec/graph.yaml` or `traverspec/assets/`, before considering the task finished. It mechanically catches structural mistakes (a dangling reference, an illegal edge type, a malformed entry, a blank asset file, a missing skill file) the moment they happen, rather than leaving them to surface later as confusing or silently wrong behavior. If it reports issues, fix them before presenting your work as done — a failing validate result is not something to note and move past.

If `traverspec` isn't available in this project, skip this step; its absence is not an error.

---

## Route by task

Read the routing file(s) below that match what you're about to do. If a task spans more than one category (e.g. you're implementing a feature and will need to update its spec afterward), read all the files that apply.

**I'm implementing, modifying, or answering a question about existing code or behavior.**
→ Read `traversal_policy.md`. It tells you how to find the entry point and gather exactly the context you need — no more, no less.
→ You will also need `structure_reference.md` to understand what the content of each node type means once you've loaded it. Read both.

**I'm checking whether the spec still matches the code** — the person asked me to reconcile, or it's a good moment to check before starting new work.
→ Read `traversal_policy.md`, then `reconcile.md`.

**I'm writing or updating a spec node directly** (the person is telling you what should exist, in plain terms — "add a business rule that says X").
→ Read `structure_reference.md`. It defines valid node types, edge types, file schema, naming, and folder layout.

**I've been given an existing document (PDF, doc, pasted text, a Notion export, anything) and asked to convert it into this project's structure.**
→ Read `structure_reference.md`, then `ingest_spec.md`.

**I'm having a conversation with the person to help them author a new spec from scratch — they don't have a document, just an idea.**
→ Read `structure_reference.md`, then `author_via_chat.md`.

**I've been pointed at an existing codebase and asked to produce or update the spec graph from what it actually does** (not a document, not a conversation — the code itself is the source).
→ Read `structure_reference.md`, then `derive_spec_from_code.md`.

**I'm asked for a build order, roadmap, or sequencing plan across features** — waves, stages, sprints, "what should we build first."
→ Read `structure_reference.md`, then `plan.md`.

If you're unsure which of these you're doing, default to reading `structure_reference.md` — it's the foundation every other file assumes you already know.

---

## What this file is not

This file does not explain what a node type is, how traversal works, or how to write good spec content. It only tells you where to look. Do not try to implement anything or write any spec content based on this file alone.
