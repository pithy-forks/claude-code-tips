#!/usr/bin/env bun
// tested with: claude code v2.1.132
//
// PostToolUse hook for cc plugin (v3.2 hook migration).
//
// Reads the PostToolUse JSON payload from stdin, extracts touched file paths
// from tool_input, writes them as recent_files rows in cc's sessions.db.
// Uses CLAUDE_CODE_SESSION_ID (CC 2.1.132+) plus payload.session_id (newer
// CC always passes it) for session keying.
//
// Replaces the in-process transcript-tail FSWatcher (~194 LOC). Hook-driven
// writes are simpler and don't require the cc MCP server to be tailing the
// transcript file -- which previously broke when sessionId/cwd resolution
// failed.
//
// Failure mode: this hook is fail-soft. A crash here must NOT block the
// caller's tool call. Every operation is wrapped to swallow errors and
// exit 0.

import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

// Same path keys as the deleted lib/transcript-tail.ts. Order in the set
// doesn't matter; we extract every match.
const PATH_KEYS = new Set([
  "file_path",
  "notebook_path",
  "path",
  "filepath",
  "target",
]);

const MAX_PATHS_PER_SESSION = 10;

function extractPaths(input: unknown, out: Set<string>): void {
  if (!input || typeof input !== "object") return;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PATH_KEYS.has(k) && typeof v === "string" && v.length > 0) {
      out.add(v);
    } else if (Array.isArray(v)) {
      for (const item of v) extractPaths(item, out);
    } else if (v && typeof v === "object") {
      extractPaths(v, out);
    }
  }
}

function gitOutput(args: string[], cwd: string): string | null {
  try {
    const r = spawnSync("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: 1500,
    });
    return r.status === 0 ? r.stdout.trim() || null : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  let payload: Record<string, unknown> = {};
  try {
    const raw = await Bun.stdin.text();
    if (raw) payload = JSON.parse(raw);
  } catch {
    return; // unparseable stdin
  }

  const sid =
    (typeof payload.session_id === "string" && payload.session_id) ||
    process.env.CLAUDE_CODE_SESSION_ID ||
    "";
  if (!sid) return;

  const paths = new Set<string>();
  extractPaths((payload as { tool_input?: unknown }).tool_input, paths);
  if (paths.size === 0) return;

  // cc state dir resolution mirrors server.ts.
  const claudeDir =
    process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const ccDir =
    process.env.CC_STATE_DIR || path.join(claudeDir, "channels", "cc");
  const dbPath = path.join(ccDir, "sessions.db");

  // cc not initialized yet (no live session ever connected on this machine).
  if (!fs.existsSync(dbPath)) return;

  const cwd = (typeof payload.cwd === "string" && payload.cwd) || process.cwd();
  const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const worktree = gitOutput(["rev-parse", "--show-toplevel"], cwd);

  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readwrite: true });

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
    // Defensive heartbeat: silent-edit-only sessions still update last_seen
    // so peer overlap detection works even when the session never calls cc
    // tools directly.
    const heartbeat = db.prepare(
      `UPDATE sessions
         SET last_seen_at_ms = ?,
             branch = COALESCE(?, branch),
             worktree_root = COALESCE(?, worktree_root)
       WHERE id = ?`,
    );

    const nowMs = Date.now();
    const tx = db.transaction((arr: string[]) => {
      for (const p of arr) upsert.run(sid, p, branch, worktree, nowMs);
      trim.run(sid, sid, MAX_PATHS_PER_SESSION);
      heartbeat.run(nowMs, branch, worktree, sid);
    });
    tx([...paths]);
  } catch {
    // schema mismatch / db locked / permission — fail soft
  } finally {
    db?.close();
  }
}

await main();
