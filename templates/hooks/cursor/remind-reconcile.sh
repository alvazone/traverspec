#!/bin/bash
command -v jq >/dev/null 2>&1 || { echo "TraverSpec hook: jq not found, install it (brew install jq / apt install jq)." >&2; exit 1; }
INPUT=$(cat)
WORKSPACE_ROOT=$(echo "$INPUT" | jq -r '.workspace_roots[0]')
CONVERSATION_ID=$(echo "$INPUT" | jq -r '.conversation_id')
STATE_FILE="$WORKSPACE_ROOT/.cursor/traverspec-hooks/state/$CONVERSATION_ID.json"

[[ ! -f "$STATE_FILE" ]] && exit 0

COUNT=$(jq '.touched_files | length' "$STATE_FILE")
[[ "$COUNT" -eq 0 ]] && exit 0

FILES=$(jq -r '.touched_files | join(", ")' "$STATE_FILE")
echo '{"touched_files": []}' > "$STATE_FILE"

cat <<EOF
{"followup_message": "Before finishing: $FILES changed since the last check. Read traverspec/skills/reconcile.md and check whether traverspec/graph.yaml still matches, using traverspec show to scope it."}
EOF
exit 0
