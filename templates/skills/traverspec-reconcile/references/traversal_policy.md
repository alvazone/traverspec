# Traversal Policy

This file explains how to gather context from the spec graph for a task — implementing something, explaining how something works, or reasoning about the impact of a change.

Gathering context is a mechanical closure computation, not something to hand-simulate. `traverspec show` computes it — exhaustively, no depth limit, `overrides` always included — for the exact same reasoning this file used to describe doing by hand. Standing rule 6 already covers getting the CLI installed; this file assumes that's settled and picks up from there.

Every task boils down to filling in this one command's two parameters:

```
traverspec show <entry_point>[,<entry_point>...] --direction <forward|reverse|both>
```

`<entry_point>` — see "Resolve the entry point," below. `--direction` — see "Deciding direction," below.

---

## Resolve the entry point

Figure out which node the task is actually about — resolve directly by matching the task against node names and ids, not by starting at an epic and working your way in. Any node type can be an entry point; there's no requirement to resolve through an `epic` first, even if the task mentions one (epics filter, they don't gate access — see `structure_reference.md` §4). Fragmenting the graph into per-epic subgraphs to control scope was considered and rejected for the same reason — it would gate access to nodes by an arbitrary grouping label rather than by what the task actually needs.

Run `traverspec list [--type <type>]` instead of reading `graph.yaml` by eye — `--type` narrows to one node type (`feature`, `data_model`, `api_contract`, `business_rule`, `decision`, `epic`, or `ui_component`), omit it to list every node. It returns one line per node — id, type, title, and a short description pulled from the asset file's first paragraph of prose (blank if the file doesn't have one yet):

```
feature:checkout  [feature]  Checkout — Lets a signed-in user convert their cart into an order.
data_model:Order  [data_model]  Order
```

`--json` returns the same fields (`id`, `type`, `path`, `title`, `description`) as an array of objects instead of formatted text. Match the task's wording against `id`/`title`/`description` to find the entry point:

- "Implement checkout" → `feature:checkout`.
- "Why does the refund endpoint fail on weekends" → the relevant `api_contract` node.
- "What breaks if I change the User table" → `data_model:User`. **This is an impact-analysis question, not implement/explain — same entry point, opposite direction (see "Deciding direction," below).**

If nothing matches, say so — don't guess at the nearest-sounding node and proceed as if confirmed.

### When more than one node matches

A word like "checkout" can match several nodes at once (`feature:checkout` and `api_contract:POST-orders-checkout`). Resolve deliberately, don't pick arbitrarily:

1. **Let the task's wording disambiguate first.** "Implement checkout" asks about the capability → the `feature`. "Why does the checkout endpoint return a 500" asks about the operation → the `api_contract`.
2. **If wording doesn't disambiguate, prefer the broader node — usually the `feature`.** Its forward traversal reaches the related `api_contract` anyway (via `triggers`), so entering at the feature loses nothing. Entering at the `api_contract` risks the opposite: contracts rarely have their own outgoing edges, so you can end up stranded with a nearly empty result.
3. **If it's still genuinely unclear** — no `feature` node exists, or two equally-specific nodes match with no textual cue — ask, same as if nothing matched.

---

## Deciding direction

Direction is a fixed mapping from task type, not a judgment call to make fresh each time:

- **Implement/explain tasks** → `--direction forward`.
- **Impact-analysis tasks** ("what breaks if I change X," "what depends on X") → `--direction reverse`.
- **Genuinely uncertain, or the task explicitly needs the full picture** → `--direction both` (the default if the flag is omitted).

For multiple entry points that all genuinely matter to the task (not merely ambiguous candidates — see "When more than one node matches," above), pass them comma-separated: `traverspec show id1,id2`.

---

## Reading the result

Text output is grouped by level (hop distance from the entry point). `--json` returns the same data structured as `{ levels: [{ level, nodes, edges }], coveredNodes, totalNodes }`. Example:

```
$ traverspec show feature:signup --direction forward
traverspec show: 4 of 11 nodes covered.

level 1:
  nodes:
    - data_model:User
    - business_rule:BR-0002-unique-email
    - decision:DC-0014-legacy-duplicate-emails
  edges:
    - from: feature:signup
      type: mutates
      to: data_model:User
    - from: feature:signup
      type: enforces
      to: business_rule:BR-0002-unique-email
    - from: decision:DC-0014-legacy-duplicate-emails
      type: overrides
      to: business_rule:BR-0002-unique-email
```

Note `decision:DC-0014-legacy-duplicate-emails` landing at **level 1** — the same level as the rule it overrides, not one level deeper. `overrides` is checked on every node the result touches, regardless of direction, and attaches at that node's own level, because it's a correction to that node's meaning, not a further hop away from it. Without it, "email must be unique" would look absolute when a documented exception exists — always load and read whatever `overrides` brings in.

**The result is a mechanical skeleton, not the final answer.** It tells you which nodes are structurally connected; it can't see anything that only exists in prose and was never captured as an edge. **Load the actual content of every node it returns — its `traverspec/assets/<type>/<name>.md` file, per `structure_reference.md` §6 — and read it. That step doesn't go away.**

**Don't second-guess the result's size.** A result covering a large share of the graph ("65 of 180 nodes covered") isn't a bug — large result sets reflect real coupling in the underlying product, not a flaw in the graph or the tool, and some nodes genuinely have that much impact. There is no depth cap by design: something reachable five hops out is exactly as relevant as something one hop out, because it's still part of what the task touches. Don't decide what to skip by level or by the result feeling large. Use edge type instead (see "Reading priority," below) to decide where to focus first. If the result is still large after that, surface the scope to the person and let them decide whether to proceed broadly or narrow the task, rather than silently reading everything or silently skipping part of it.

---

## Reading priority: what edge type tells you

Not every node `show` returns needs the same depth of reading. `overrides` is a hard requirement; everything else below is a signal to weigh, not a filter to apply blindly.

| Edge type | What it signals | Reading guidance |
|---|---|---|
| `depends_on` | Genuinely can't be understood or built without this existing | Usually worth reading in full — real structural coupling |
| `mutates` | Writes to data owned by the target | Read closely if the change touches the target's shape or fields |
| `reads` | Reads data from the target without changing it | Check whether the specific fields being changed are among what's read |
| `enforces` | Where a business rule is actually checked | Read carefully if the rule itself is changing, lighter check otherwise |
| `foreign_key` | Schema-level reference between two data models | Check the specific referenced field — high relevance for identity/shape changes |
| `triggers` | Causes execution, same request cycle | Relevant mainly if the invocation itself is changing |
| `calls` | A UI component invoking an API contract | Same as `triggers` — relevant if request/response shape is changing |
| `dispatches` | Asynchronous, out-of-band invocation | Relevant mainly if what gets dispatched, or when, is changing |
| `overrides` | Not a guideline — still a rule | Always read, every time — skipping it produces a wrong understanding, not an incomplete one |

At each edge, ask: does this specific change actually touch what this edge type cares about? If clearly no, a lighter pass is reasonable; if yes or unsure, read it properly.

---

## If the CLI genuinely isn't available

Standing rule 6 already asks the person to install it before you get here. If they've explicitly declined, or it's genuinely not installable in this environment, gathering context falls back to reading `graph.yaml` by hand — slower, and reliable only on a small graph, since hand-tracing edges at any real scale is exactly the kind of task this project doesn't trust an agent to do correctly. Use the same entry-point and direction logic above. Say plainly that you're doing this manually, so the person knows the result is less exhaustive than `show` would give them — don't present a manual pass as equivalent.
