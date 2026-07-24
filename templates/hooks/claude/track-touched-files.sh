#!/bin/bash
command -v jq >/dev/null 2>&1 || { echo "TraverSpec hook: jq not found, install it (brew install jq / apt install jq)." >&2; exit 1; }
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
STATE_FILE="$CLAUDE_PROJECT_DIR/.claude/hooks/state-$SESSION_ID.json"

[[ -z "$FILE_PATH" ]] && exit 0
[[ "$FILE_PATH" == *"/traverspec/"* ]] && exit 0

mkdir -p "$(dirname "$STATE_FILE")"
[[ ! -f "$STATE_FILE" ]] && echo '{"touched_files": []}' > "$STATE_FILE"

jq --arg f "$FILE_PATH" '.touched_files |= ((. + [$f]) | unique)' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
exit 0
