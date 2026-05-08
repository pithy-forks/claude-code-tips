// Scenario: multi-peer roster visibility.
//
// Two peers in the SAME isolated CLAUDE_CONFIG_DIR. Measure how long after
// spawn-of-bob until alice's roster includes bob.
//
// Real measurements:
//   - alice.boot, bob.boot (spawn → init ack)
//   - bob.spawned → alice.sees_bob (the convergence latency we care about)
//   - alice.sessions roundtrip ms (per call)

import { Harness } from "../harness.js";
import { Peer } from "../peer.js";

export const scenarioName = "02-multi-peer-roster";

export default async function run(h: Harness, pluginRoot: string): Promise<void> {
  const alice = new Peer({
    name: "alice",
    sessionId: "alice-multi-peer-0000000000000000",
    cwd: pluginRoot,
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
    ccDebug: true,
  });
  const bob = new Peer({
    name: "bob",
    sessionId: "bob-multi-peer-0000000000000000",
    cwd: pluginRoot,
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
    ccDebug: true,
  });

  h.recordSample("alice.boot", await alice.start());

  // Mark the moment bob is spawned. We measure from this point until alice's
  // roster includes bob, regardless of how long bob's own boot takes — alice's
  // visibility-of-bob is the cross-peer convergence signal.
  const bobSpawnedAt = performance.now();
  h.recordSample("bob.boot", await bob.start());

  // Poll alice's sessions until bob shows up.
  const { ms: timeToVisible } = await h.waitFor(
    "alice-sees-bob",
    async () => {
      const r = await alice.callAction("sessions", { include_self: false });
      h.recordSample("alice.sessions.rt", r.ms);
      const peers = (r.parsed as { sessions?: Array<{ id: string }> }).sessions ?? [];
      return peers.some((p) => p.id === bob.opts.sessionId);
    },
    { deadlineMs: 5000, intervalMs: 50 },
  );

  // Real metric: latency from "bob exists" to "alice sees bob in roster".
  // bob.boot itself is the time-to-MCP-ready; we want the slightly bigger
  // number that includes bob's self-register write to the shared DB landing.
  const totalMs = performance.now() - bobSpawnedAt;
  h.recordSample("bob-spawned-to-alice-sees-bob", totalMs);
  h.note(`bob spawned → alice sees bob: ${totalMs.toFixed(3)}ms (waitFor returned at ${timeToVisible.toFixed(3)}ms relative to its own start)`);

  h.expectLt("alice-sees-bob under 5s SLO", totalMs, 5000);

  await alice.stop();
  await bob.stop();
}
