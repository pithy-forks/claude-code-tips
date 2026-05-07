-- cc v3 metadata schema. Metadata only; message bodies stay on filesystem.
--
-- v3 changes from v2:
--   sessions: + project_root, branch, worktree_root (for branch/worktree-aware
--             file-overlap detection -- see commit 6 in PR #56)
--   recent_files: + branch, worktree_root captured at touch time so a peer's
--                 conflict alert can match (path, branch) OR (path, worktree)
--                 without re-resolving the peer's current branch
--   The 'topics', 'subscriptions', and 'announcements.topics' columns are
--   retained even though commit 5 drops them from the user surface -- the
--   schema is cheap, and a future opt-in topic UX won't need a migration.
--
-- Schema is idempotent (CREATE ... IF NOT EXISTS, ALTER ... ADD COLUMN guarded
-- by introspection in db/migrate.ts).

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  cwd TEXT,
  project_root TEXT,
  branch TEXT,
  worktree_root TEXT,
  role TEXT,
  pid INTEGER,
  started_at_ms INTEGER NOT NULL,
  last_seen_at_ms INTEGER NOT NULL,
  last_checked_at_ms INTEGER,
  ended_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen_at_ms);
CREATE INDEX IF NOT EXISTS idx_sessions_ended ON sessions(ended_at_ms);
-- Indexes that reference v3 columns are created in db/migrate.ts after the
-- ADD COLUMN step, so they apply cleanly to upgraded v2 databases.

CREATE TABLE IF NOT EXISTS topics (
  name TEXT PRIMARY KEY,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  session_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  subscribed_at_ms INTEGER NOT NULL,
  PRIMARY KEY (session_id, topic)
);
CREATE INDEX IF NOT EXISTS idx_subs_topic ON subscriptions(topic);

-- Wave C: declarative subscription matchers. Replaces the v2 topic surface.
-- Each row is one match rule for a session: "show me events that touch
-- {file_glob} AND/OR are produced by {peer_match} AND/OR meet urgency_min".
-- The legacy `subscriptions` table above stays dormant for back-compat.
CREATE TABLE IF NOT EXISTS cc_subs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_glob TEXT,
  peer_match TEXT,
  urgency_min TEXT,
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cc_subs_session ON cc_subs(session_id);

CREATE TABLE IF NOT EXISTS recent_files (
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  branch TEXT,
  worktree_root TEXT,
  touched_at_ms INTEGER NOT NULL,
  PRIMARY KEY (session_id, path)
);
CREATE INDEX IF NOT EXISTS idx_recent_files_touched ON recent_files(touched_at_ms);
CREATE INDEX IF NOT EXISTS idx_recent_files_path ON recent_files(path);
-- v3 (path, branch) and (path, worktree_root) indexes added in db/migrate.ts

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  topics TEXT,
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at_ms);
CREATE INDEX IF NOT EXISTS idx_announcements_session ON announcements(session_id, created_at_ms);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  from_sid TEXT NOT NULL,
  to_sid TEXT,
  topic TEXT,
  question TEXT NOT NULL,
  options TEXT,
  context TEXT,
  blocking INTEGER DEFAULT 0,
  opened_at_ms INTEGER NOT NULL,
  answered_at_ms INTEGER,
  answer TEXT,
  answered_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_questions_to ON questions(to_sid, answered_at_ms);
CREATE INDEX IF NOT EXISTS idx_questions_from ON questions(from_sid, answered_at_ms);
