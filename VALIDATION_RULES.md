# Validation Rules

This is the language-agnostic spec for what `traverspec validate` checks. It exists separately from the Node implementation so a future port (Python or otherwise) can implement the same rules independently and be tested against the same fixture library, rather than being a translation of this codebase.

Every rule below is a **hard fail** (non-zero exit) unless explicitly marked otherwise. There is no soft-warning tier in v1 — see "Deliberately not checked" for the one exception carved out on purpose.

---

## 1. Referential integrity

- Every `id` referenced as a `from` or `to` in `edges` must exist as an `id` in `nodes` (or, for `epics`, as an `epic:` field value on a node).
- Every node's `path` must point to a file that actually exists on disk.
- Every file under `assets/**/*.md` must be claimed by exactly one node's `path` in `graph.yaml` — no orphan files.
- No duplicate `id` values across `epics` and `nodes` combined.
- Every node's `epic` field (if present) must reference an `id` that exists under `epics`.

## 2. Type legality

- Every node's `type` must be one of: `epic`, `feature`, `data_model`, `api_contract`, `business_rule`, `decision`, `ui_component`. (`epic` entries themselves don't carry a `type` field — they're identified by appearing under the `epics:` key.)
- Every edge's `type` must be one of: `depends_on`, `mutates`, `reads`, `triggers`, `enforces`, `foreign_key`, `calls`, `overrides`, `dispatches`.
- Unknown type strings — of either kind — are a hard fail. This is the check that catches a typo'd edge type outright.

## 3. Structural shape (per-bucket exact key-set)

Every entry under `epics:`, `nodes:`, and `edges:` must have exactly the keys its bucket allows — no more, no fewer, no nested lists or sub-mappings as values:

- `epics` entries: exactly `{id, name, path}`.
- `nodes` entries: exactly `{id, type, path}`, plus optionally `epic`.
- `edges` entries: exactly `{from, type, to}`.

This check exists specifically to catch silent structural corruption from a bad manual edit — an indentation slip that reparents an edge under the wrong node, or merges two entries into one, can produce a file that's still syntactically valid but describes a different graph than intended. A referential-integrity check alone won't catch this if the resulting (wrong) structure still happens to reference real ids; the exact-key-set check does, because the shape itself becomes visibly wrong the moment it's non-uniform.

## 4. `overrides` direction

Every `overrides` edge must have `from` of type `decision` and `to` of type `business_rule`. This is the one edge type where the pairing is enforced, not just documented as typical — see "Deliberately not checked" for why every other edge type is different.

## 5. Sequential numbering integrity

- Every `business_rule` id must match `BR-\d{4}` and every `decision` id must match `DC-\d{4}`.
- No duplicate numbers within either sequence.
- Gaps in the sequence (e.g. BR-0001, BR-0002, BR-0004 with no BR-0003) are a hard fail — the filename is expected to mirror the id exactly, and gaps usually mean a node was deleted without renumbering the ones after it, or a number was picked without checking `graph.yaml` first.

## 6. Skill-file presence

The installed package bundles a pristine reference copy of the required skill files (`start_here.md`, `structure_reference.md`, `traversal_policy.md`, `ingest_spec.md`, `author_via_chat.md`, `derive_spec_from_code.md`, `plan.md`). `validate` checks that all seven exist under `traverspec/skills/` in the project being validated. A missing file is a hard fail.

**Content differences from the pristine copy are never flagged.** Per-project customization of these files is expected and encouraged — this check only catches outright deletion or a file never having been scaffolded, not divergence in wording.

## 7. Asset content presence

Every node/epic's asset file, once confirmed to exist (rule 1), must not be blank — empty, or whitespace-only after trimming. This does not check whether the content is correct or well-formed, only that some content exists. A file that fails rule 1 (doesn't exist) is not also reported here, that would be double-reporting the same underlying problem.

---

## Deliberately not checked

**Which node types an edge type connects.** `structure_reference.md`'s "Typical from → to" column documents the common case for each edge type, but it is documentation, not a schema constraint. A `data_model → business_rule` `enforces` edge — say, a DB-level CHECK constraint that enforces a rule directly, independent of any feature — is completely legitimate even though the typical pairing is `feature → business_rule`. Enforcing pairing would reject correct edges the schema explicitly allows. The single exception is `overrides` (rule 4), whose direction is load-bearing for the traversal policy's reverse-check behavior, not just a common-case convention.

**Prose content quality.** `validate` checks that content exists (rule 7), not whether it's any good, whether a `business_rule`'s Rationale is well-written or whether a `feature`'s Acceptance Criteria are actually testable. That's a human/agent judgment call, not a mechanical one.

**Semantic drift between the graph and the actual codebase.** Referential integrity can be perfect — every id resolves, every edge type legal — while an edge no longer reflects what the code actually does. `validate` cannot see this; it requires the close reading described in `derive_spec_from_code.md`'s reconciliation mode.
