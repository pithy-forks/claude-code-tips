-- cc v2 metadata schema. Metadata only; message bodies stay on filesystem.

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  cwd TEXT,
  role TEXT,
  pid INTEGER,
  started_at_ms INTEGER NOT NULL,
  last_seen_at_ms INTEGER NOT NULL,
  last_checked_at_ms INTEGER,
  ended_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen_at_ms);
CREATE INDEX IF NOT EXISTS idx_sessions_ended ON sessions(ended_at_ms);

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

CREATE TABLE IF NOT EXISTS recent_files (
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  touched_at_ms INTEGER NOT NULL,
  PRIMARY KEY (session_id, path)
);
CREATE INDEX IF NOT EXISTS idx_recent_files_touched ON recent_files(touched_at_ms);
CREATE INDEX IF NOT EXISTS idx_recent_files_path ON recent_files(path);

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
