#!/usr/bin/env bash
# tested with: claude code v2.1.118
# SessionStart hook: inject "you're in <project>, started at <time>" hint.
# No cross-plugin reads. Pure stdlib. Always exits 0.

exec 2>/dev/null

{
  set -euo pipefail
  JQ="$(command -v jq || true)"
  GIT="$(command -v git || true)"
  [ -z "$JQ" ] && exit 0

  input="$(cat 2>/dev/null || echo '{}')"
  cwd="$("$JQ" -r '.cwd // empty' 2>/dev/null <<< "$input")"
  [ -z "$cwd" ] && cwd="$PWD"
  cwd="${cwd%/}"

  scope="$cwd"
  if [ -n "$GIT" ]; then
    root="$("$GIT" -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
    [ -n "$root" ] && scope="${root%/}"
  fi

  shown_scope="${scope/#$HOME/\~}"
  project="$(basename "$scope" 2>/dev/null || echo "?")"
  started_at="$(date '+%H:%M %Z')"

  "$JQ" -cn \
    --arg ctx "[time:project] started in ${project} (${shown_scope}) at ${started_at}" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'

  exit 0
}

exit 0
