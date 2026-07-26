This project's specifications are not stored as flat documents. They live as a **graph**: small, single-concern markdown files (`traverspec/assets/`), with all relationships between them declared explicitly in one file (`traverspec/graph.yaml`).

# Standing Rules

These apply on every turn, regardless of which skill (if any) is in play.

1. **Check whether the `traverspec` CLI is actually installed, once per session, and enforce it.** A `traverspec/` folder existing doesn't mean the command is available — check both separately. If the folder exists but the command doesn't, don't just tell the person to install it — ask permission to install it yourself, then run it: `npm install --save-dev @alvazone/traverspec` if this looks like a Node project (a `package.json` exists at the root), or a global install (`npm install -g @alvazone/traverspec`) otherwise. Only fall back to the slower, less reliable manual traversal (see the `traverspec-read` skill) if the install fails or they decline permission to run it. Once you have an answer either way, don't ask again this session.

2. **Check `traverspec/graph.yaml` before creating any new node** (feature, data_model, api_contract, business_rule, decision, epic, or optional types). Creating a duplicate — a second `data_model:User`, a second `feature:checkout` — silently fractures the graph: some edges end up pointing at one copy, some at the other, and nothing detects the split. If something looks like it should exist but doesn't, that's fine — create it. This rule is about checking, not about hesitating.

3. **Verify before stating what a file, function, command, or graph entry contains or does.** Read the file, run the command, or check `graph.yaml` in this session — don't answer from memory or confidence, even when you're sure you already know. If you haven't opened it this session, you're recalling it, and recall can be wrong or stale.

4. **Propose a spec update the moment a conversation settles something the spec should say.** This applies regardless of task — implementation and bug-fix conversations settle real decisions too, not just spec-authoring ones. Ask before actually editing (see rule 5); this rule is about noticing and proposing, not staying silent until asked.

5. **Ask before editing `traverspec/graph.yaml` or `assets/`.** Never assume a change is wanted. This is separate from CODEOWNERS: CODEOWNERS (if configured) gates whether an already-made edit can be merged; this gates whether the edit gets proposed at all.

6. **Read `traverspec/about.md` once per session, if it exists and isn't empty**, before starting task-specific work. It holds the product's Problem/Solution/Goals/Non-Goals — background for judging whether something belongs in the product at all, not a rule to check against. Don't re-read it if already read this session; an empty or missing file is not an error.

7. **Run `traverspec validate` after writing or editing anything in `graph.yaml` or `assets/`, before considering the task finished**, if the CLI is available. Fix anything it reports — a failing result is not something to note and move past. Skip this step if the CLI isn't available; that's not an error either.

8. **Load `traverspec/constitution.md` unconditionally, every session, if it exists.** It holds standing, project-wide rules (e.g. "all endpoints require auth") that apply regardless of what you're working on. It's not a node, has no edges, and nothing leads you to it by traversal — load it as a fixed step, not something a task routes you into.
