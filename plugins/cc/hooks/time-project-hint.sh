#!/usr/bin/env bash
# tested with: claude code v2.1.118
# SessionStart hook: inject "last 5 sessions in cwd" timing hint.
# Robust by design: exit 0 on any failure, no external timeout command needed.
# Uses sqlite3 -readonly + internal busy-timeout + outer hook timeout in hooks.json.
# Reads ~/.claude/mine.db (owned by the `mine` plugin). Absent => silent no-op.

exec 2>/dev/null

{
  JQ="$(command -v jq || true)"
  SQLITE="$(command -v sqlite3 || true)"
  GIT="$(command -v git || true)"
  [ -z "$JQ" ] && exit 0
  [ -z "$SQLITE" ] && exit 0

  input="$(cat 2>/dev/null || echo '{}')"
  cwd="$("$JQ" -r '.cwd // empty' 2>/dev/null <<< "$input")"
  current_id="$("$JQ" -r '.session_id // empty' 2>/dev/null <<< "$input")"
  [ -z "$cwd" ] && cwd="$PWD"
  cwd="${cwd%/}"

  # Resolve to git repo root if inside a repo; otherwise use cwd literally.
  # So being in a subdirectory matches the whole project, not just the subdir.
  scope="$cwd"
  if [ -n "$GIT" ]; then
    root="$("$GIT" -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
    [ -n "$root" ] && scope="${root%/}"
  fi

  safe_scope="$(printf '%s' "$scope" | tr -d "'\"\\\\;")"
  safe_id="$(printf '%s' "$current_id" | tr -d "'\"\\\\;")"

  db="$HOME/.claude/mine.db"
  [ ! -r "$db" ] && exit 0

  result=$("$SQLITE" -readonly -cmd ".timeout 1200" -separator '|' "$db" <<SQL 2>/dev/null
SELECT
  COUNT(*),
  ROUND(AVG(duration_active_seconds)/60.0, 1),
  ROUND(AVG(tool_use_count), 0),
  MAX(DATE(start_time)),
  SUM(CASE WHEN compaction_count > 0 THEN 1 ELSE 0 END)
FROM (
  SELECT duration_active_seconds, tool_use_count, compaction_count, start_time
  FROM sessions
  WHERE is_subagent = 0
    AND duration_active_seconds > 30
    AND id != '${safe_id}'
    AND (cwd = '${safe_scope}' OR cwd LIKE '${safe_scope}/%')
  ORDER BY start_time DESC
  LIMIT 5
);
SQL
)

  [ -z "$result" ] && exit 0
  IFS='|' read -r n avg_min avg_tools last_day compacted <<< "$result"
  [ -z "$n" ] || [ "$n" = "0" ] && exit 0

  shown_scope="${scope/#$HOME/\~}"
  [ -z "$compacted" ] && compacted=0
  compact_pct=0
  [ "$n" != "0" ] && compact_pct=$(( compacted * 100 / n ))

  "$JQ" -cn \
    --arg ctx "[cc timing · last ${n} sessions in ${shown_scope}]
avg active: ${avg_min} min · avg tools: ${avg_tools} · most recent: ${last_day} · compaction: ${compacted}/${n} (${compact_pct}%)" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'

  exit 0
}

exit 0
