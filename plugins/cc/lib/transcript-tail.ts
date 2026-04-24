// tested with: claude code v2.1.118
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type Database from "better-sqlite3";

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
  db: Database.Database;
  sessionId: string;
  cwd: string;
  maxPaths?: number;
}): () => void {
  const { db, sessionId, cwd } = opts;
  const maxPaths = opts.maxPaths ?? 10;
  const file = findTranscriptFile(sessionId, cwd);
  if (!file) return () => {};

  const upsert = db.prepare(
    `INSERT INTO recent_files (session_id, path, touched_at_ms)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id, path) DO UPDATE SET touched_at_ms = excluded.touched_at_ms`,
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
  let timer: NodeJS.Timeout | null = null;

  const readDelta = () => {
    if (stopped) return;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return;
    }
    if (stat.size < offset) {
      // file rotated or truncated
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
          // Claude Code assistant messages nest tool_use inside entry.message.content
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
        const now = Date.now();
        const tx = db.transaction((arr: string[]) => {
          for (const p of arr) upsert.run(sessionId, p, now);
          trim.run(sessionId, sessionId, maxPaths);
        });
        tx([...paths]);
      }
    } catch {
      // transient read error; try again next tick
    }
  };

  readDelta();
  timer = setInterval(readDelta, 2500);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
