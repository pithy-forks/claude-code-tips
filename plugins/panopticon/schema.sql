CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  session_id TEXT,
  tool_name TEXT,
  tool_input TEXT,
  exit_code INTEGER
);

-- Optional indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_actions_session ON actions(session_id);
CREATE INDEX IF NOT EXISTS idx_actions_tool ON actions(tool_name);
CREATE INDEX IF NOT EXISTS idx_actions_timestamp ON actions(timestamp);
