# Evidence calibration: conversation

Apply this when the evidence is something the person is telling you directly, right now.

This is usually the highest-confidence evidence type — if they've stated it, it's theirs, not inferred. The specific risk isn't ambiguity in wording or mechanism-vs-intent; it's **capturing a first-draft thought as if it were settled** when a little more conversation would have sharpened it. If what's being described still sounds like it's being worked out rather than decided, that's a signal to stay in *Elicitation* (in `SKILL.md`) rather than write yet, even though something has technically been said.

What to listen for, by node type, once something is ready to write:
- **feature** — what it does, who or what triggers it, what should explicitly not happen (scope boundaries are often clearer once stated than left implicit), and concrete acceptance conditions — this feeds Acceptance Criteria directly, so ask for checkable conditions, not vague ones.
- **data_model** — what fields it actually needs, which are required vs. optional, and whether it connects to anything already in the graph.
- **api_contract** — the exact trigger (method/path/operation), what success returns, and what failure looks like (people describe the happy path fluently and skip errors — ask explicitly).
- **business_rule** — is this really standalone, or just detail belonging inside one feature? If it only ever applies to one feature and nothing else references it, it may not need to be its own node — ask, rather than defaulting to creating one.
- **decision** — these surface as an aside, not something someone sets out to author ("oh, but that's not true for legacy accounts"). Pause the main thread and capture it properly — what's the exception, what does it override, and why. Don't let it stay a buried one-line note.
