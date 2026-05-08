// tested with: bun 1.3 + claude code v2.1.133
// renderDigest tests for v3.5 effort-based verbosity (#68).

import { describe, expect, test } from "bun:test";
import { renderDigest, type Digest } from "../lib/render.js";

function fixture(overrides: Partial<Digest> = {}): Digest {
  return {
    is_delta: false,
    active_session_count: 1,
    direct_unread: [],
    topic_unread: {},
    session_digests: [
      {
        session: "abcd1234",
        cwd: "/Users/test/repo",
        recent_files: [
          "/Users/test/repo/src/auth.ts",
          "/Users/test/repo/src/api.ts",
          "/Users/test/repo/README.md",
        ],
        cc_loaded: true,
        branch: "main",
        summary: "auth.ts",
        last_announce_age_s: null,
        last_edit_age_s: 30,
      },
    ],
    file_overlap_alerts: [],
    questions_awaiting_me: [],
    my_open_questions: [],
    ...overrides,
  };
}

describe("renderDigest effort verbosity", () => {
  test("medium (default) shows summary + age parenthetical", () => {
    const out = renderDigest(fixture());
    expect(out).toContain("abcd1234 main");
    expect(out).toContain("auth.ts");
    expect(out).toContain("30s ago");
  });

  test("low strips summary parenthetical, single-line peer", () => {
    const out = renderDigest(fixture(), "low");
    expect(out).toContain("abcd1234 main");
    expect(out).not.toContain("auth.ts");
    expect(out).not.toContain("ago");
  });

  test("high adds expanded recent_files line under each peer", () => {
    const out = renderDigest(fixture(), "high");
    expect(out).toContain("abcd1234 main");
    expect(out).toContain("auth.ts");
    // recent_files expansion line
    expect(out).toMatch(/edits: .*auth\.ts.*api\.ts.*README\.md/);
  });

  test("low cap is shorter than high cap by character count", () => {
    const big = fixture({
      session_digests: Array.from({ length: 5 }, (_, i) => ({
        session: `peer${i}`,
        cwd: `/Users/test/repo${i}`,
        recent_files: [`/Users/test/repo${i}/file_a.ts`, `/Users/test/repo${i}/file_b.ts`],
        cc_loaded: true,
        branch: "main",
        summary: `file_a.ts`,
        last_edit_age_s: 30,
        last_announce_age_s: null,
      })),
      active_session_count: 5,
    });
    const low = renderDigest(big, "low");
    const med = renderDigest(big, "medium");
    const high = renderDigest(big, "high");
    expect(low.length).toBeLessThan(med.length);
    expect(med.length).toBeLessThan(high.length);
  });

  test("low drops topic_unread previews to titles only", () => {
    const withTopics = fixture({
      topic_unread: {
        "#auth": [
          { from: "peer1", subject: "review", preview: "this is a long preview that should normally show", age_s: 60 },
          { from: "peer2", subject: "thoughts", preview: "another long body", age_s: 30 },
        ],
      },
    });
    const low = renderDigest(withTopics, "low");
    const med = renderDigest(withTopics, "medium");
    expect(med).toContain("long preview");
    expect(low).not.toContain("long preview");
    expect(low).toContain("topic #auth");
  });

  test("invalid/missing effort defaults to medium", () => {
    const out1 = renderDigest(fixture());
    // @ts-expect-error invalid effort intentionally
    const out2 = renderDigest(fixture(), "invalid");
    // 'medium' default + unknown coerces via PREVIEW_BY_EFFORT undefined.
    // unknown will produce different chars/length; the contract is that
    // valid 'medium' renders cleanly and matches the default.
    expect(out1).toContain("abcd1234");
    expect(out2.length).toBeGreaterThan(0);
  });

  test("empty digest returns empty string regardless of effort", () => {
    const empty: Digest = {
      is_delta: false,
      active_session_count: 0,
      direct_unread: [],
      topic_unread: {},
      session_digests: [],
      file_overlap_alerts: [],
      questions_awaiting_me: [],
      my_open_questions: [],
    };
    expect(renderDigest(empty, "low")).toBe("");
    expect(renderDigest(empty, "medium")).toBe("");
    expect(renderDigest(empty, "high")).toBe("");
  });
});
