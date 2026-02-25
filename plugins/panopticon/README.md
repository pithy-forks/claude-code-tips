# panopticon

Audit trail for every tool action Claude Code takes. Every Bash command, every file edit, every search -- logged to a local SQLite database with timestamps and session IDs.

## What it does

The `PostToolUse` hook fires after every tool invocation. This plugin captures:

- **Timestamp** -- when the action happened
- **Session ID** -- which Claude Code session triggered it
- **Tool name** -- `Bash`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, etc.
- **Tool input** -- the command, file path, search pattern, or edit content
- **Exit code** -- whether the tool succeeded or failed

Everything goes into `~/.claude/panopticon.db`, a SQLite database you can query directly.

## Why

Claude Code sessions are ephemeral. Once you close a session, the conversation is gone. But sometimes you need to know:

- What commands did Claude run yesterday?
- Did it modify files I didn't review?
- How many tool calls did that refactoring session take?
- What was the exact sequence of operations that broke the build?

Panopticon gives you full replay capability across all sessions.

## Install

Copy the plugin directory and reference the hook:

```json
{
  "hooks": {
    "PostToolUse": [{ "type": "command", "command": ".claude/plugins/panopticon/hooks/panopticon.sh" }]
  }
}
```

Make executable:

```bash
chmod +x .claude/plugins/panopticon/hooks/panopticon.sh
```

## Schema

```sql
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  session_id TEXT,
  tool_name TEXT,
  tool_input TEXT,
  exit_code INTEGER
);
```

Initialize manually if you want:

```bash
sqlite3 ~/.claude/panopticon.db < .claude/plugins/panopticon/schema.sql
```

The hook script auto-creates the table on first run.

## Querying

```bash
# All actions from today
sqlite3 ~/.claude/panopticon.db "SELECT * FROM actions WHERE timestamp >= date('now')"

# All Bash commands from a specific session
sqlite3 ~/.claude/panopticon.db "SELECT timestamp, tool_input FROM actions WHERE session_id = 'abc123' AND tool_name = 'Bash'"

# Tool usage frequency
sqlite3 ~/.claude/panopticon.db "SELECT tool_name, COUNT(*) as count FROM actions GROUP BY tool_name ORDER BY count DESC"

# Failed operations
sqlite3 ~/.claude/panopticon.db "SELECT * FROM actions WHERE exit_code != 0"

# Actions in the last hour
sqlite3 ~/.claude/panopticon.db "SELECT * FROM actions WHERE timestamp >= datetime('now', '-1 hour')"
```

## Dependencies

- `sqlite3` (pre-installed on macOS)
- `jq` for JSON parsing

## Privacy

All data stays local in `~/.claude/panopticon.db`. Nothing leaves your machine. Delete the database anytime to clear the log.
