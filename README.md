<p align="center">
  <img src="assets/brand/social-preview.png" width="100%" alt="TraverSpec — a traversable spec graph for AI coding agents">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

## About

TraverSpec turns your product spec into a typed, traversable graph so an AI coding agent can answer "what does this touch?" precisely, instead of reading your entire spec or hoping a similarity search finds the right document. It ships as a CLI that only runs at authoring time: everything it produces is plain markdown and YAML committed to your repo, so there is zero runtime dependency and nothing running in production.

## Overview

Two common ways to give an AI agent context about a codebase both share the same weakness. Flat markdown docs (one big spec file, or one doc per feature) require reading everything to find out what a change affects, which gets expensive or impossible once a real product's spec runs into the hundreds of pages. Vector or RAG search scales past that, but retrieves by semantic similarity, so it has no concept of "this feature enforces that rule" or "this data model is a foreign key of that one" unless the relationship happens to be phrased similarly to the query.

TraverSpec stores specs as a graph instead of a document. Each node (a feature, a data model, an API contract, a business rule, a decision, an epic) is its own small markdown file with human-readable content only. Every relationship between nodes is a typed, directional edge declared in one file, `graph.yaml`. Nothing is inferred from prose proximity or embedding distance; anything traversable is explicit.

```mermaid
graph LR
    checkout["feature:checkout"] -->|reads| User[("data_model:User")]
    login["feature:login"] -->|reads| User
    signup["feature:signup"] -->|mutates| User
    RefreshToken[("data_model:RefreshToken")] -->|foreign_key| User
```

To answer "what breaks if I change `User`?", an agent walks the edges pointing at `User` and gets an exact, complete answer: `checkout`, `login`, `signup`, `RefreshToken`. That answer holds regardless of whether the codebase is 20 files or 20,000.

## Installation

If the project you're adding this to is itself a Node project (it has a `package.json`), install it as a dev dependency, the same way you would `eslint` or `typescript` — it's never imported by application code, only run as a CLI, so it belongs in `devDependencies`, not a global install. This also pins the version in `package-lock.json`, so every contributor and every CI run uses the same one:

```bash
npm install --save-dev @alvazone/traverspec
npx traverspec --help
```

If the target project isn't a Node project at all, or you just want it available everywhere without pinning it per-project, install it globally instead:

```bash
npm install -g @alvazone/traverspec
traverspec --help
```

Either way, if `--help` prints the command list, the install worked.

## Quickstart

```bash
traverspec init
```

Scaffolds the `traverspec/` folder (`about.md`, `constitution.md`, `graph.yaml`, `assets/`, and the eight skill files under `skills/`) and adds or updates `AGENTS.md`, read natively by Cursor and most other agentic tools. Safe to run again: existing content is never overwritten, only appended to inside a clearly marked block.

For tools that don't read `AGENTS.md` on their own, like Claude Code, wire up their entry file with `--agent`:

```bash
traverspec init --agent claude
```

This additionally writes `CLAUDE.md` (a one-line import of `AGENTS.md`).

## Structure reference

**Node types**

| Type | Represents |
|---|---|
| `epic` | A grouping label for related features. Filtering only, never appears as an edge. |
| `feature` | A user-facing capability. The most common entry point for implement/explain tasks. |
| `data_model` | The schema and fields for an entity or value object. |
| `api_contract` | One endpoint or operation, REST, GraphQL, WebSocket, or SSE. Always its own node, never a section inside a feature. |
| `business_rule` | A domain constraint or piece of logic that isn't specific to one feature. |
| `decision` | A documented, intentional exception to what would otherwise look like the correct pattern. Always paired with an `overrides` edge. |
| `ui_component` *(optional)* | An interface requirement, a button, a form, a screen element. Skip entirely for backend-only projects. |

**Edge types**

| Type | Meaning |
|---|---|
| `depends_on` | The `from` node can't be understood or implemented without the `to` node already existing. |
| `mutates` | The `from` node writes or changes data owned by the `to` node. |
| `reads` | The `from` node reads data owned by the `to` node without changing it. |
| `triggers` | The `from` node causes the `to` node to execute, typically how a feature is invoked. |
| `enforces` | The `from` node is where a business rule is actually applied or checked. |
| `foreign_key` | A field on the `from` data model references the `to` data model. |
| `calls` | A UI component calls or renders an API contract (only relevant if using `ui_component`). |
| `overrides` | The `from` node (a `decision`) is a documented, intentional exception to the `to` node (a `business_rule`). Traversal checks for one of these on every node it loads, in both directions, since skipping it produces a wrong understanding of the rule rather than just an incomplete one. |
| `dispatches` | The `from` node's completion causes the `to` node to run, asynchronously, out of band, not the same request/response cycle. Distinct from `depends_on` and `triggers`, which describe prerequisite and same-cycle invocation relationships. |

## Commands

| Command | What it does |
|---|---|
| `traverspec init [--agent <names>]` | Scaffold `traverspec/` and wire up agent entry files. Idempotent. |
| `traverspec add-agent <names>` | Wire up an additional tool later without re-scaffolding (`cursor`, `claude`). |
| `traverspec validate [--json]` | Structural and referential integrity check. Non-zero exit on any issue. |
| `traverspec list [--type <type>] [--json]` | Lightweight id/type/title/description index of every node, for resolving a node id before using `show`. |
| `traverspec show <node_id>[,<node_id>...] [--direction forward\|reverse\|both] [--json]` | Dependency/impact closure for one or more nodes, grouped by level (hop distance) as `graph.yaml`-shaped edges. Direction defaults to `both`. |
| `traverspec check-plan [--json]` | Check whether `traverspec/plan/plan.md` still matches the current `graph.yaml`, or is stale. |
| `traverspec refresh-skills [--yes]` | Pull in skill-file updates from the installed package version, with confirmation before overwriting any customized file. |
| `traverspec add-codeowners --tool <github\|gitlab>` | Gate changes to `traverspec/` behind review. Never run automatically, opt-in since solo projects don't need it. |
| `traverspec add-hooks <cursor\|claude>` | Wire up an opt-in nudge to run `reconcile.md` after editing code, before finishing a turn. Merges into any existing hooks config for that tool, never overwrites it. Requires `jq`. |
| `traverspec remove-hooks <cursor\|claude>` | Remove only the hook entries `add-hooks` added, leaving any other hooks in that same config untouched. |
| `traverspec remove [--yes]` | Remove `traverspec/` and agent entry files from this project, after a confirmation prompt. `--yes` skips it for scripted use. |

## Versioning

Everything TraverSpec creates lives in your repo as plain text: `graph.yaml`, the per-node markdown files under `traverspec/assets/`, and the skill files under `traverspec/skills/`. There's no separate database or hosted service to keep in sync, so history, diffs, blame, and branching all come from git the same as any other source file.

To control who can change the spec itself, run `traverspec add-codeowners --tool github` (or `--tool gitlab`). This adds a CODEOWNERS entry scoping the entire `traverspec/` folder, graph content and skill files alike, to an owner you specify, replacing the `@CHANGE_ME` placeholder it writes. On its own this only requests review, it doesn't block merges. To actually enforce it, enable your git host's branch protection on top: GitHub's "Require review from Code Owners", or an equivalent approval rule tied to a protected branch on GitLab.

## Skill files

`init` copies eight markdown files into `traverspec/skills/`. They're what an agent reads to work inside the graph correctly, and they're yours to edit once scaffolded.

| File | Purpose |
|---|---|
| `start_here.md` | Entry point. Tells the agent what to read next depending on the task, and the one rule that applies regardless of what it's about to do. |
| `structure_reference.md` | Defines the node and edge types, file layout, and content schema. What things are, not how to move between them. |
| `traversal_policy.md` | How to gather context for a task: resolving an entry point, forward vs. reverse traversal, and the `constitution.md`/`overrides` exceptions to forward-only traversal. |
| `ingest_spec.md` | Converting an existing document (a PDF, a Notion export, pasted notes) into the graph. |
| `derive_spec_from_code.md` | Generating the graph, or reconciling it wholesale, against a codebase that isn't mapped into the graph yet. |
| `reconcile.md` | Checking existing nodes against existing code, on demand, scoped to one entry point at a time — narrower and more frequent than a full `derive_spec_from_code.md` pass. |
| `author_via_chat.md` | Building a spec through conversation, when the information only exists in someone's head and hasn't been written down anywhere yet. |
| `plan.md` | Deriving a dependency-ordered build plan (features grouped into sequential waves) from the graph's edges plus prose in `traverspec/assets/`. |

## VS Code extension

[TraverSpec Graph Explorer](https://marketplace.visualstudio.com/items?itemName=alvazone.traverspec-vscode) renders `graph.yaml` as an interactive, explorable node diagram inside VS Code, for browsing the graph visually instead of jumping between files. Install it from the Marketplace, or see the [source repo](https://github.com/alvazone/traverspec-vscode).

## Known limitations

- **Context-scoping only pays off past a real size threshold.** On a small graph, reading everything is cheaper than the fixed cost of an agent learning the routing rules.
- **Large result sets reflect real coupling, not a bug.** A `depends_on` chain, or a heavily-referenced `data_model` with many `foreign_key`/`mutates`/`reads` edges into it, can legitimately pull in most of the graph for a single task, `data_model:User`'s reverse closure on a real 180-node graph covered 65 nodes. Minimal context isn't a guaranteed property of using a graph, it's a property of how coupled the underlying product actually is.
- **`validate` checks structural and referential integrity, not semantic accuracy.** Every id can resolve and every edge type can be legal while an edge no longer reflects what the code actually does. Catching that requires the review process in `reconcile.md` (or `derive_spec_from_code.md` when generating from scratch), not a mechanical check.
- **Nothing detects on its own when the spec has drifted from the code, unless you opt into `add-hooks`.** That's a direct consequence of staying zero runtime: there's no process watching your codebase by default. `traverspec add-hooks <cursor|claude>` adds a per-project, per-tool nudge after code gets edited, but it only ever tells an agent to go check `reconcile.md`, it can't verify the check was done well, or done at all if the hook was never set up. Running reconciliation periodically is still ultimately a deliberate choice you or your agent make, the hook lowers how often that choice gets forgotten, it doesn't remove the choice.

## Status

`0.2.0`, pre-1.0. Following semver, but expect the CLI surface and skill file content to still change between minor versions until a 1.0 release.

## License

MIT
