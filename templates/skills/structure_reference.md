# Structure Reference

This file defines what exists in this project's spec graph and what shape it takes: node types, edge types, the file layout on disk, and the content schema for each kind of asset. Read this before creating, editing, or interpreting anything in `traverspec/assets/` or `traverspec/graph.yaml`.

This file does not explain how to traverse the graph to gather context for a task — that's `traversal_policy.md`. This file is about what things *are*, not how to *walk between them*.

---

## 1. The two files that make up the graph

- **`traverspec/graph.yaml`** — the single source of truth for what nodes exist and how they relate. Every node is registered here with an `id`, a `type`, and a `path` to its content file. Every relationship between nodes is declared here as an edge.
- **`traverspec/assets/*.md`** — one file per node, containing only its human-readable content. These files never declare relationships themselves — no frontmatter, no edge lists. If you're looking for how something connects to something else, that answer is in `graph.yaml`, not in the `.md` file.

Treat these two as a pair. Reading only the `.md` file tells you what a thing is; reading only `graph.yaml` tells you what it connects to. You typically need both.

---

## 2. Node types

Every node has exactly one `type`. These are the only valid values.

**Core types — use these on virtually every project:**

| Type | What it represents | Notes |
|---|---|---|
| `epic` | A grouping label for related features (e.g. "Billing," "Authentication"). | Not a traversal participant — see Section 4. Used for filtering and planning, not for describing relationships. |
| `feature` | A user-facing capability. | The most common entry point when someone asks you to implement or explain something. Granularity is a judgment call — see Section 2a. |
| `data_model` | The schema and fields for an entity or value object. | |
| `api_contract` | One endpoint or operation — REST, GraphQL, WebSocket, or SSE. | Always its own node. Never write endpoint details as a section inside a `feature` file, even if only one feature uses that endpoint. |
| `business_rule` | A domain constraint or piece of logic that isn't specific to one feature. | |
| `decision` | A record of an intentional deviation from what would otherwise look like the correct or consistent pattern. | Always paired with an `overrides` edge — see Section 3. If you encounter a node whose content seems inconsistent with a rule or pattern elsewhere, check for a `decision` node overriding it before assuming the spec is wrong or stale. |

**Optional types — only use these if the project has a real need for them:**

| Type | What it represents | When to skip it |
|---|---|---|
| `ui_component` | An interface requirement (a button, a form, a screen element). | Skip entirely for backend-only or API-only projects. |

If a project has never used `ui_component` and you're not sure whether to introduce it, don't — ask, or default to describing UI behavior as prose inside the relevant `feature` file instead.

### 2a. Node granularity is a judgment call, not a fixed rule

There is no fixed size for a `feature`. The test is: **would anything ever need to fetch this piece independently of its surrounding content?** If yes, it's probably its own node. If no, it's a section of prose inside a larger node.

Example: an entire multi-stage AI pipeline (upload → transcribe → diarize → summarize) can correctly be a single `feature` node, with the internal stages described as prose sections inside that one file — *if* nothing else in the graph ever needs to point at "just the diarization step" on its own. Compare this to `api_contract`, which is always its own node regardless of size, because endpoints are frequently reused or referenced independently of any one feature.

When authoring a new node and you're unsure whether to split it further, ask yourself whether a future edge would ever need to point at the smaller piece specifically. If you can't think of one, don't split it.

---

## 3. Edge types

Edges are directed and typed. They live only in `traverspec/graph.yaml`, under the `edges` list, as `from` / `type` / `to` triples. Direction matters: `feature:checkout --mutates--> data_model:Order` is not the same claim as the reverse.

| Edge | Meaning | Typical `from → to` |
|---|---|---|
| `depends_on` | The `from` node cannot be understood or implemented without the `to` node already existing. | feature → feature |
| `mutates` | The `from` node writes or changes data owned by the `to` node. | feature → data_model |
| `reads` | The `from` node reads data owned by the `to` node without changing it. | feature → data_model |
| `triggers` | The `from` node causes the `to` node to execute. | feature → api_contract |
| `enforces` | The `from` node is where a business rule is actually applied or checked. | feature → business_rule |
| `foreign_key` | A field on the `from` data_model references the `to` data_model. | data_model → data_model |
| `calls` *(only relevant if using `ui_component`)* | The `from` UI component calls or renders the `to` node. | ui_component → api_contract |
| `overrides` | The `from` node is a documented, intentional exception to the `to` node. | decision → business_rule |
| `dispatches` | The `from` node's completion causes the `to` node to run — asynchronously, out of band, not within the same request/response cycle. | feature → feature |

`overrides` is the one edge type with special traversal behavior — always checked, in both directions, regardless of entry point. See Section 4 in `traversal_policy.md` for why.

**`dispatches` vs `depends_on` vs `triggers`.** These three can look similar between two features and are easy to conflate — pick based on what kind of fact is actually being stated, not on which one "sounds close enough":
- `depends_on` — a static prerequisite: the `from` node cannot be understood or implemented without the `to` node already existing. No claim about runtime ordering or causation.
- `triggers` — synchronous, same-operation invocation: the `from` node's normal execution path directly calls or executes the `to` node (typically feature → api_contract — this is how the feature is invoked).
- `dispatches` — asynchronous, completion-based causation: finishing the `from` node causes the `to` node to run afterward, out of band (a job, an event, a deferred process) — not how `from` is invoked, but what `from` sets in motion once it's done.

Only write a `dispatches` edge when the source node's own content explicitly states the handoff (e.g. "on completion, enqueue X" or "after this, X runs") — the same confidence-gating standard `ingest_spec.md` already applies to every other edge type. Don't infer it from two features merely occurring near each other in a workflow.

When authoring a new edge, pick the type that matches the actual relationship, not the closest available one. If none of these actually describe the relationship you're trying to express, stop and ask rather than force-fitting an existing type — that's a signal the schema may need to grow, not a signal to improvise.

---

## 4. `epic` is a label, not a graph relationship

`epic` never appears as an edge. It's a plain field directly on a node's entry in `traverspec/graph.yaml`:

```yaml
- id: feature:checkout
  type: feature
  epic: epic:billing
  path: assets/feature/checkout.md
```

There is no `epic-to-epic` edge and no `epic-to-feature` edge. Epics are used for grouping and filtering — "show me everything under billing" — not for describing how things relate to each other. If two features in different epics are actually connected, that connection is expressed as a normal edge between the features (or between whatever they both touch, like a shared `data_model`) — never by relating the epics themselves.

---

## 5. `graph.yaml` schema

```yaml
epics:
  - id: epic:billing
    name: Billing
    path: assets/epic/billing.md

nodes:
  - id: feature:checkout
    type: feature
    epic: epic:billing
    path: assets/feature/checkout.md

  - id: data_model:User
    type: data_model
    path: assets/data_model/User.md

edges:
  - from: feature:checkout
    type: mutates
    to: data_model:Order

  - from: decision:DC-0001
    type: overrides
    to: business_rule:BR-0001
```

**Field notes:**

- `id` — required on every node and epic. Format is `type:name` (e.g. `feature:checkout`, `business_rule:BR-0001`). This is what edges reference — never reference a node by its file path.
- `type` — one of the node types in Section 2.
- `path` — relative path to the node's `.md` content file, relative to `traverspec/graph.yaml`'s own location (i.e. relative to the `traverspec/` folder itself, not the repo root) — e.g. `assets/feature/checkout.md`, not `traverspec/assets/feature/checkout.md`.
- `epic` — present only on nodes that belong to one (see Section 4). Not present on `epic` entries themselves.

There is no `description` field on epics, and no `status` field on nodes. Both were considered and deliberately excluded — don't add them without checking with the person first, they were rejected for specific reasons (drift risk from hand-maintained fields going stale).

---

## 6. Folder layout

Everything lives inside a single `traverspec/` folder at the repo root — a plain, visible, git-tracked folder, not a dotfile. Type-first, flat within each type:

```
traverspec/
├── about.md
├── constitution.md
├── graph.yaml
├── skill-versions.json  (tooling metadata — which package version each skill file was last synced from; not for hand-editing)
├── skills/
│   ├── start_here.md
│   ├── structure_reference.md
│   ├── traversal_policy.md
│   ├── ingest_spec.md
│   ├── author_via_chat.md
│   └── derive_spec_from_code.md
└── assets/
    ├── epic/
    ├── feature/
    ├── data_model/
    ├── api_contract/
    ├── business_rule/
    ├── decision/
    └── ui_component/        (only if the project uses this optional type)
```

Every node's file lives under `traverspec/assets/<type>/`, regardless of which epic it belongs to. Do not create epic-named subfolders — a node like `data_model:User` may be used by several epics, and there is no single epic folder it could correctly live in.

### Naming convention

- `epic`, `feature`, `data_model`, `api_contract`, `ui_component` — plain, descriptive filenames matching the node's name: `checkout.md`, `User.md`, `POST-orders-checkout.md`.
- `business_rule`, `decision` — sequential codes, not descriptive names: `BR-0001.md`, `BR-0002.md`, `DC-0001.md`. The filename mirrors the `id`. Before creating a new one, check `traverspec/graph.yaml` for the highest existing number of that prefix and increment — never reuse or guess a number.

---

## 7. Asset file content schema, per type

Every asset file opens with a single `# Title` heading matching the node's name. Below that, use the sections below as a **strong default, not a hard requirement**. If a node's content doesn't cleanly fit a section, use your judgment — write good prose over forcing a bad fit into a heading. Do not reject or refuse to create a node because it's missing one of these sections.

**feature**
```markdown
# Checkout

## Summary
One or two sentences: what this does, for whom.

## Behavior
The actual spec — what happens, step by step, including edge cases.

## Acceptance Criteria
Concrete, testable conditions that must hold true for this feature
to be considered correctly implemented.

## Out of scope
What this feature deliberately does not handle.
```

**data_model**
```markdown
# Order

One-line description. May reference another entity for shared shape
or semantics, e.g. "Same shape as X."

## Fields
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, not null |
| user_id | uuid | FK → User, not null |

## Invariants
Business-level rules about the data itself, beyond what the
Constraints column already states.
```

Note the single `Constraints` column — it holds required/nullable, foreign key target, uniqueness, and defaults together (e.g. `FK → User, not null`). If a field's constraint is a foreign key, also add a `foreign_key` edge in `traverspec/graph.yaml` for that relationship — the table cell is for human readability, the edge is what makes it traversable.

**api_contract**
```markdown
# POST /orders/checkout

One-line description of what this does.

## Auth Required
Yes/No — and the mechanism, if yes.

## Request
Headers and/or body, as needed.

## Response Body — 200
| Field | Type | Notes |
|---|---|---|

## Error Responses
| Code | Status | When |
|---|---|---|
```

`Code` is the application-level error code (e.g. `INVALID_REFRESH_TOKEN`); `Status` is the HTTP status. Keep them as separate columns — multiple error codes can share one HTTP status, and an agent implementing error handling needs to branch on the code, not just the status.

**business_rule**
```markdown
# BR-0001: Email must be unique

## Statement
One clear sentence stating the rule.

## Rationale
Why this rule exists.

## Applies to
Which features or data models this constrains, in prose. (The
actual edges — `enforces`, etc. — live in graph.yaml; this section
is for human context, not a substitute for the edges.)
```

**decision**
```markdown
# DC-0001: Allow duplicate emails on merged legacy accounts

## Status
Accepted / Rejected / Superseded

## Context
The situation that forced this decision.

## Decision
What was actually decided.

## Consequences
What this means going forward — and, explicitly, what should
NOT be "fixed" by someone who encounters this later without context.
```

**epic**
```markdown
# Billing

## Overview
What this epic covers and how its features relate to each other
conceptually. This is prose for human and agent understanding —
it is never a list of member features. Membership is derived by
querying nodes in graph.yaml for `epic: epic:billing`, not by
reading this file.
```

---

## 8. If something doesn't fit

If you're authoring content that doesn't map cleanly onto an existing node type, or a relationship that doesn't match an existing edge type, stop and ask the person rather than forcing it into the closest available option. A forced fit now is a harder problem to untangle later than a short pause to clarify.
