// tested with: claude code v2.1.118
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Database } from "bun:sqlite";

// Watches this session's own transcript file for tool_use entries,
// extracts touched file paths, publishes them to sessions.db.recent_files.
// Fully optional: if the transcript path can't be resolved, this is a no-op
// and the plugin still works (recent_files just stays empty for this session).

const TRANSCRIPT_ROOT = path.join(
  process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"),
  "projects",
);

const PATH_KEYS = new Set([
  "file_path",
  "notebook_path",
  "path",
  "filepath",
  "target",
]);

function cwdToProjectDir(cwd: string): string {
  // Claude Code encodes cwd as path with "/" replaced by "-". Leading "/" becomes "-".
  return cwd.replace(/\//g, "-");
}

function findTranscriptFile(sessionId: string, cwd: string): string | null {
  const projectDir = path.join(TRANSCRIPT_ROOT, cwdToProjectDir(cwd));
  const candidate = path.join(projectDir, `${sessionId}.jsonl`);
  if (fs.existsSync(candidate)) return candidate;

  // Fallback: search every project dir for this session id (slow but robust).
  try {
    for (const entry of fs.readdirSync(TRANSCRIPT_ROOT)) {
      const p = path.join(TRANSCRIPT_ROOT, entry, `${sessionId}.jsonl`);
      if (fs.existsSync(p)) return p;
    }
  } catch {
    // ignore
  }
  return null;
}

function extractPaths(toolInput: unknown, out: Set<string>): void {
  if (!toolInput || typeof toolInput !== "object") return;
  for (const [k, v] of Object.entries(toolInput as Record<string, unknown>)) {
    if (PATH_KEYS.has(k) && typeof v === "string" && v.length > 0) {
      out.add(v);
    } else if (Array.isArray(v)) {
      for (const item of v) extractPaths(item, out);
    } else if (v && typeof v === "object") {
      extractPaths(v, out);
    }
  }
}

export function startTranscriptTail(opts: {
  db: Database;
  sessionId: string;
  cwd: string;
  maxPaths?: number;
  // Returns the *current* branch + worktree at the moment a file is touched.
  // The getter closure reads server.ts's myGitContext snapshot, refreshed
  // lazily inside onActivity (~60s TTL), so a branch switch is reflected on
  // the next file touched after the refresh window. Optional (for tests).
  gitContext?: () => { branch: string | null; worktree_root: string | null };
  // Fired once per readDelta that produced new path entries. Callers use this
  // to lazily refresh sessions.last_seen + git context (replaces the v3 30s
  // heartbeat timer). Optional so tests can omit it.
  onActivity?: () => void;
}): () => void {
  const { db, sessionId, cwd } = opts;
  const maxPaths = opts.maxPaths ?? 10;
  const gitContext = opts.gitContext ?? (() => ({ branch: null, worktree_root: null }));
  const onActivity = opts.onActivity;
  const file = findTranscriptFile(sessionId, cwd);
  if (!file) return () => {};

  const upsert = db.prepare(
    `INSERT INTO recent_files (session_id, path, branch, worktree_root, touched_at_ms)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id, path) DO UPDATE SET
       branch = excluded.branch,
       worktree_root = excluded.worktree_root,
       touched_at_ms = excluded.touched_at_ms`,
  );
  const trim = db.prepare(
    `DELETE FROM recent_files
     WHERE session_id = ?
       AND path NOT IN (
         SELECT path FROM recent_files WHERE session_id = ?
         ORDER BY touched_at_ms DESC LIMIT ?
       )`,
  );

  let offset = 0;
  try {
    offset = fs.statSync(file).size;
  } catch {
    offset = 0;
  }

  let buffer = "";
  let stopped = false;
  let watcher: fs.FSWatcher | null = null;
  let safetyTimer: NodeJS.Timeout | null = null;
  let pending = false;

  const readDelta = () => {
    if (stopped) return;
    pending = false;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return;
    }
    if (stat.size < offset) {
      offset = 0;
      buffer = "";
    }
    if (stat.size === offset) return;
    try {
      const fd = fs.openSync(file, "r");
      const len = stat.size - offset;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);
      fs.closeSync(fd);
      offset = stat.size;
      buffer += buf.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      const paths = new Set<string>();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          const content = entry?.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block?.type === "tool_use") {
                extractPaths(block.input, paths);
              }
            }
          } else if (entry?.type === "tool_use") {
            extractPaths(entry.input, paths);
          }
        } catch {
          // skip malformed line
        }
      }
      if (paths.size > 0) {
        // Fire activity callback FIRST: callers refresh git context (TTL-gated)
        // so the upsert below picks up branch changes inside this same delta.
        onActivity?.();
        const now = Date.now();
        const ctx = gitContext();
        const tx = db.transaction((arr: string[]) => {
          for (const p of arr) {
            upsert.run(sessionId, p, ctx.branch, ctx.worktree_root, now);
          }
          trim.run(sessionId, sessionId, maxPaths);
        });
        tx([...paths]);
      }
    } catch {
      // transient read error; safety timer will retry
    }
  };

  // Coalesce burst events into one read on the next macrotask.
  const schedule = () => {
    if (stopped || pending) return;
    pending = true;
    setImmediate(readDelta);
  };

  readDelta();

  // Primary path: filesystem watcher (FSEvents on macOS, inotify on linux).
  // bun:sqlite + fs.watch coexist cleanly; bun's fs.watch is implemented
  // natively. fires within ~10-50ms of an append.
  try {
    watcher = fs.watch(file, { persistent: false }, schedule);
  } catch {
    watcher = null;
  }

  // Safety-net poll: catches the rare missed event (rotation, network FS,
  // platform quirks). 30s is slow enough to be near-free, fast enough to
  // recover within one user turn if the watcher missed a write.
  safetyTimer = setInterval(schedule, 30_000);

  return () => {
    stopped = true;
    watcher?.close();
    if (safetyTimer) clearInterval(safetyTimer);
  };
}
