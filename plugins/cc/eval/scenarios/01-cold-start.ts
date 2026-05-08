// Scenario: cold-start time-to-visibility.
//
// Spawn one peer in a fresh CLAUDE_CONFIG_DIR. Measure:
//   1. spawn → MCP initialize ack       (peer.start() return)
//   2. boot → first cc(action='sessions') visible row
//   3. boot → SessionStart hook write to sessions.db (if available)
//
// SLO: cold-start should resolve to a visible roster row in <2000ms.

import { Database } from "bun:sqlite";
import * as path from "node:path";
import { Harness, sleep } from "../harness.js";
import { Peer } from "../peer.js";

export const scenarioName = "01-cold-start";

export default async function run(h: Harness, pluginRoot: string): Promise<void> {
  const peer = new Peer({
    name: "alice",
    sessionId: "alice-cold-start-0000000000000000",
    cwd: pluginRoot,                  // git-aware cwd so project_root resolves
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
    ccDebug: true,
    ccTraceSql: true,
  });

  const bootMs = await peer.start();
  h.recordSample("peer.boot", bootMs);
  h.note(`peer.boot = ${bootMs.toFixed(3)}ms (process spawn → MCP initialize ack)`);
  h.expectLt("boot under 3s SLO", bootMs, 3000);

  // First sessions call. Should always include self when include_self=true.
  // Our own row was inserted by the server's self-register block on boot.
  const r1 = await peer.callAction("sessions", { include_self: true });
  h.recordSample("first-sessions-call", r1.ms);
  h.expectLt("first sessions call under 500ms", r1.ms, 500);

  const parsed = r1.parsed as { sessions?: Array<{ id: string }> };
  const ownVisible = parsed.sessions?.some((s) => s.id === peer.opts.sessionId) ?? false;
  h.expect("own session visible in roster", ownVisible, {
    actual: parsed.sessions?.length ?? 0,
    expected: ">= 1 row, including self",
  });

  // Verify the SessionStart hook would have written the row by reading the
  // sessions table directly. (In a real session, the hook fires; in our
  // synthetic peer the hook isn't invoked because we bypass Claude Code's
  // hook dispatcher. So the row comes from the server's own self-register.)
  const dbPath = path.join(h.ccStateDir, "sessions.db");
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .prepare("SELECT id, started_at_ms, last_seen_at_ms, project_root, branch FROM sessions WHERE id = ?")
      .get(peer.opts.sessionId) as
      | { id: string; started_at_ms: number; last_seen_at_ms: number; project_root: string | null; branch: string | null }
      | undefined;
    h.expect("sessions row exists for peer", row != null, {
      actual: row ? "row found" : "no row",
      expected: "row exists",
    });
    if (row) {
      h.note(`sessions row: project_root=${row.project_root} branch=${row.branch}`);
    }
  } finally {
    db.close();
  }

  await peer.stop();
}
