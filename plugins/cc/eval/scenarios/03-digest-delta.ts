// Scenario: digest_delta on cc.check after a peer announce.
//
// alice announces something. bob's next cc.check should include alice's
// announcement in its digest_delta block. We measure announce→delta-visible
// latency end-to-end.

import { Harness, sleep } from "../harness.js";
import { Peer } from "../peer.js";

export const scenarioName = "03-digest-delta";

type DeltaShape = {
  digest_delta?: { new_announcements?: Array<{ session_id?: string; summary?: string }> };
};

export default async function run(h: Harness, pluginRoot: string): Promise<void> {
  const alice = new Peer({
    name: "alice",
    sessionId: "alice-digest-delta-0000000000000",
    cwd: pluginRoot,
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
  });
  const bob = new Peer({
    name: "bob",
    sessionId: "bob-digest-delta-0000000000000000",
    cwd: pluginRoot,
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
  });

  h.recordSample("alice.boot", await alice.start());
  h.recordSample("bob.boot", await bob.start());

  // Bob does an initial check to set his last_checked_at_ms cursor. Anything
  // after this should appear in his next digest_delta.
  const bob1 = await bob.callAction("check");
  h.recordSample("bob.check.initial", bob1.ms);

  // Alice announces.
  const announceText = `eval-marker-${Math.random().toString(36).slice(2, 10)}`;
  const announceSentAt = performance.now();
  const announceResp = await alice.callAction("announce", { summary: announceText });
  h.recordSample("alice.announce.rt", announceResp.ms);

  // Bob polls check until he sees alice's announce in digest_delta.
  await h.waitFor(
    "bob-sees-alice-announce-in-delta",
    async () => {
      const r = await bob.callAction("check");
      h.recordSample("bob.check.poll", r.ms);
      // The check action returns rendered text. The withDelta wrap adds
      // digest_delta to the response payload — but only when there's something
      // new. Our text is the rendered digest, so we look for the announce
      // marker in there. (Server returns text, not raw JSON, for `check`.)
      return typeof r.parsed === "string" && r.parsed.includes(announceText);
    },
    { deadlineMs: 5000, intervalMs: 50 },
  );

  const announceToBobMs = performance.now() - announceSentAt;
  h.recordSample("announce-to-bob-visible", announceToBobMs);
  h.note(`alice.announce sent → bob saw it in digest: ${announceToBobMs.toFixed(3)}ms`);
  h.expectLt("announce visible to bob under 2s SLO", announceToBobMs, 2000);

  await alice.stop();
  await bob.stop();
}
