#!/bin/bash
command -v jq >/dev/null 2>&1 || { echo "TraverSpec hook: jq not found, install it (brew install jq / apt install jq)." >&2; exit 1; }
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
STATE_FILE="$CLAUDE_PROJECT_DIR/.claude/hooks/state-$SESSION_ID.json"

[[ ! -d "$CLAUDE_PROJECT_DIR/traverspec" ]] && exit 0
[[ ! -f "$STATE_FILE" ]] && exit 0

COUNT=$(jq '.touched_files | length' "$STATE_FILE")
[[ "$COUNT" -eq 0 ]] && exit 0

FILES=$(jq -r '.touched_files | join(", ")' "$STATE_FILE")
echo '{"touched_files": []}' > "$STATE_FILE"

cat <<EOF
{"decision": "block", "reason": "Before finishing: $FILES changed since the last check. Read traverspec/skills/reconcile.md and check whether traverspec/graph.yaml still matches, using traverspec show to scope it."}
EOF
exit 0
