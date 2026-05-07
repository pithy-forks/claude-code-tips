#!/usr/bin/env bun
// tested with: claude code v2.1.132
//
// SessionStart hook for cc plugin (v3.3 cold-start fix).
//
// Fires when a Claude Code session starts. Registers the session in cc's
// sessions.db so peers see this session in their roster *before* it makes
// its first cc tool call. Without this, a session is invisible until it
// happens to invoke cc(action='...') — the install-trial UX bug.
//
// Read JSON from stdin (CC passes session_id, cwd, etc.). Derive git context
// locally. Insert/upsert the row. The cc MCP server's own boot path also
// writes this row; ON CONFLICT(id) DO UPDATE keeps both paths idempotent.
//
// Fail-soft: any exception → exit 0. Hooks must NEVER block session startup.

import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

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

function projectRootFromCwd(cwd: string): string | null {
  // Match server.ts:readGitContext exactly. --git-common-dir returns:
  //   ".git" (repo root), "<abs>/.git", "../.git", "../../.git/worktrees/<n>"
  // Strip optional-leading-slash + .git[/worktrees/<name>]; resolve relative
  // results against cwd. Empty after strip means cwd is the repo root.
  const out = gitOutput(["rev-parse", "--git-common-dir"], cwd);
  if (!out) return null;
  const stripped = out.replace(/(?:^|\/)\.git(?:\/worktrees\/[^/]+)?$/, "");
  return path.isAbsolute(stripped) ? stripped : path.resolve(cwd, stripped);
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

  const cwd =
    (typeof payload.cwd === "string" && payload.cwd) || process.cwd();

  // cc state dir resolution mirrors server.ts.
  const claudeDir =
    process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const ccDir =
    process.env.CC_STATE_DIR || path.join(claudeDir, "channels", "cc");
  const dbPath = path.join(ccDir, "sessions.db");

  // cc db not initialized yet — first install. The MCP server's boot path
  // creates the schema; on the next session start the hook will populate.
  if (!fs.existsSync(dbPath)) return;

  const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const worktree = gitOutput(["rev-parse", "--show-toplevel"], cwd);
  const projectRoot = projectRootFromCwd(cwd);
  const nowMs = Date.now();
  const pid = typeof process.ppid === "number" ? process.ppid : 0;

  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readwrite: true });

    // Same INSERT...ON CONFLICT shape as server.ts self-register block.
    // started_at_ms only set on initial insert; subsequent UPSERTs keep the
    // original value (DO UPDATE excludes started_at_ms).
    db.prepare(
      `INSERT INTO sessions (id, cwd, project_root, branch, worktree_root, pid, started_at_ms, last_seen_at_ms, ended_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         cwd = excluded.cwd,
         project_root = excluded.project_root,
         branch = excluded.branch,
         worktree_root = excluded.worktree_root,
         pid = excluded.pid,
         last_seen_at_ms = excluded.last_seen_at_ms,
         ended_at_ms = NULL`,
    ).run(sid, cwd, projectRoot, branch, worktree, pid, nowMs, nowMs);
  } catch {
    // schema mismatch / db locked / permission — fail soft
  } finally {
    db?.close();
  }
}

await main();
