#!/usr/bin/env bash
# panopticon.sh — PostToolUse hook
# Logs every tool action to a local SQLite database.
# Reads JSON from stdin, extracts tool metadata, inserts into ~/.claude/panopticon.db

set -euo pipefail

DB_PATH="${HOME}/.claude/panopticon.db"

# Ensure the database directory exists
mkdir -p "$(dirname "${DB_PATH}")"

# Auto-create the table if it doesn't exist
sqlite3 "${DB_PATH}" <<'SQL'
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  session_id TEXT,
  tool_name TEXT,
  tool_input TEXT,
  exit_code INTEGER
);
SQL

# Read JSON payload from stdin
INPUT=$(cat)

# Extract fields using jq
SESSION_ID=$(echo "${INPUT}" | jq -r '.session_id // "unknown"')
TOOL_NAME=$(echo "${INPUT}" | jq -r '.tool_name // .tool // "unknown"')
EXIT_CODE=$(echo "${INPUT}" | jq -r '.exit_code // 0')

# Extract tool input -- truncate to 4096 chars to keep the DB manageable
# Different tools structure their input differently
TOOL_INPUT=$(echo "${INPUT}" | jq -r '
  if .tool_input then
    (.tool_input | if type == "object" then tostring else . end)
  elif .input then
    (.input | if type == "object" then tostring else . end)
  else
    "no input captured"
  end
' | head -c 4096)

# Escape single quotes for SQL
TOOL_INPUT_ESCAPED=$(echo "${TOOL_INPUT}" | sed "s/'/''/g")
SESSION_ID_ESCAPED=$(echo "${SESSION_ID}" | sed "s/'/''/g")
TOOL_NAME_ESCAPED=$(echo "${TOOL_NAME}" | sed "s/'/''/g")

# Insert into the database
sqlite3 "${DB_PATH}" <<SQL
INSERT INTO actions (session_id, tool_name, tool_input, exit_code)
VALUES ('${SESSION_ID_ESCAPED}', '${TOOL_NAME_ESCAPED}', '${TOOL_INPUT_ESCAPED}', ${EXIT_CODE});
SQL
