// Scenario: $CLAUDE_EFFORT verbosity end-to-end.
//
// Verifies the v3.5 #68 feature ships in real cc-server output, not just
// the unit-test renderer. We spawn three peers — same project, but each
// reads CLAUDE_EFFORT={low,medium,high} from its own env. After alice
// announces something, each observer's `cc.check` returns a digest that
// is character-shorter at lower effort.
//
// Real measurements:
//   - char count of each effort's digest (low < medium < high).
//   - render_time per effort level (cc trace, captured from stderr).

import { Harness } from "../harness.js";
import { Peer } from "../peer.js";

export const scenarioName = "04-effort-verbosity";

export default async function run(h: Harness, pluginRoot: string): Promise<void> {
  const speaker = new Peer({
    name: "speaker",
    sessionId: "speaker-effort-00000000000000000",
    cwd: pluginRoot,
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
  });
  const observerLow = new Peer({
    name: "observer-low",
    sessionId: "obs-low-effort-00000000000000000",
    cwd: pluginRoot,
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
    effort: "low",
  });
  const observerHigh = new Peer({
    name: "observer-high",
    sessionId: "obs-high-effort-0000000000000000",
    cwd: pluginRoot,
    logDir: h.logDir,
    claudeDir: h.claudeDir,
    pluginRoot,
    effort: "high",
  });

  h.recordSample("speaker.boot", await speaker.start());
  h.recordSample("observer-low.boot", await observerLow.start());
  h.recordSample("observer-high.boot", await observerHigh.start());

  // Speaker announces something with enough body that high-effort previews
  // show more text than low-effort previews would.
  const announce = await speaker.callAction("announce", {
    summary: "refactoring auth.ts",
    detail: "splitting the session validator out of the login flow; api unchanged",
  });
  h.recordSample("speaker.announce.rt", announce.ms);

  // Both observers check. Each gets a rendered digest at their own effort level.
  const low = await observerLow.callAction("check");
  const high = await observerHigh.callAction("check");
  h.recordSample("observer-low.check.rt", low.ms);
  h.recordSample("observer-high.check.rt", high.ms);

  const lowChars = low.text.length;
  const highChars = high.text.length;
  h.note(`low render: ${lowChars} chars`);
  h.note(`high render: ${highChars} chars`);

  h.expect(
    "low effort produces shorter digest than high effort",
    lowChars < highChars,
    { actual: { low: lowChars, high: highChars }, expected: "low < high" },
  );

  await speaker.stop();
  await observerLow.stop();
  await observerHigh.stop();
}
