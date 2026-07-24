#!/bin/bash
command -v jq >/dev/null 2>&1 || { echo "TraverSpec hook: jq not found, install it (brew install jq / apt install jq)." >&2; exit 1; }
INPUT=$(cat)
WORKSPACE_ROOT=$(echo "$INPUT" | jq -r '.workspace_roots[0]')
CONVERSATION_ID=$(echo "$INPUT" | jq -r '.conversation_id')
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')

[[ -z "$FILE_PATH" ]] && exit 0
[[ "$FILE_PATH" == *"/traverspec/"* ]] && exit 0

STATE_DIR="$WORKSPACE_ROOT/.cursor/traverspec-hooks/state"
mkdir -p "$STATE_DIR"
STATE_FILE="$STATE_DIR/$CONVERSATION_ID.json"

[[ ! -f "$STATE_FILE" ]] && echo '{"touched_files": []}' > "$STATE_FILE"

jq --arg f "$FILE_PATH" '.touched_files |= ((. + [$f]) | unique)' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
exit 0
