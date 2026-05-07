// tested with: claude code v2.1.122 + bun 1.3
//
// Tests the verb surface single-source-of-truth: zod discriminated union,
// generated JSON Schema, parse helper. These are the bytes the model sees
// every prompt -- regressions here ripple to every agent in the loop.

import { describe, it, expect } from "bun:test";
import {
  ActionSchema,
  ACTION_JSON_SCHEMA,
  ACTION_NAMES,
  TOOL_DESCRIPTION,
  parseAction,
} from "../lib/action.ts";

describe("ActionSchema (zod source of truth)", () => {
  it("accepts every documented verb shape", () => {
    expect(ActionSchema.safeParse({ action: "sessions" }).success).toBe(true);
    expect(
      ActionSchema.safeParse({ action: "sessions", include_self: true }).success,
    ).toBe(true);
    expect(
      ActionSchema.safeParse({
        action: "send",
        to: "abcd1234",
        message: "hello",
      }).success,
    ).toBe(true);
    expect(
      ActionSchema.safeParse({
        action: "send",
        to: "abcd1234",
        message: "hello",
        subject: "s",
        urgency: "question",
        meta: { tag: "auth" },
      }).success,
    ).toBe(true);
    expect(
      ActionSchema.safeParse({ action: "announce", summary: "starting work" }).success,
    ).toBe(true);
    expect(ActionSchema.safeParse({ action: "check" }).success).toBe(true);
    expect(
      ActionSchema.safeParse({ action: "check", since_s: 60 }).success,
    ).toBe(true);
  });

  it("rejects dropped verbs (subscribe / unsubscribe / ask / answer / cleanup)", () => {
    for (const a of ["subscribe", "unsubscribe", "ask", "answer", "cleanup"]) {
      const r = ActionSchema.safeParse({ action: a });
      expect(r.success).toBe(false);
    }
  });

  it("rejects send without required fields", () => {
    expect(ActionSchema.safeParse({ action: "send" }).success).toBe(false);
    expect(ActionSchema.safeParse({ action: "send", to: "x" }).success).toBe(false);
    expect(
      ActionSchema.safeParse({ action: "send", message: "x" }).success,
    ).toBe(false);
  });

  it("rejects empty strings on required fields (zod min(1))", () => {
    expect(
      ActionSchema.safeParse({ action: "send", to: "", message: "x" }).success,
    ).toBe(false);
    expect(
      ActionSchema.safeParse({ action: "send", to: "x", message: "" }).success,
    ).toBe(false);
    expect(
      ActionSchema.safeParse({ action: "announce", summary: "" }).success,
    ).toBe(false);
  });

  it("rejects unknown urgency values", () => {
    expect(
      ActionSchema.safeParse({
        action: "send",
        to: "x",
        message: "y",
        urgency: "screaming",
      }).success,
    ).toBe(false);
  });

  it("rejects negative since_s on check (positive constraint)", () => {
    expect(
      ActionSchema.safeParse({ action: "check", since_s: -1 }).success,
    ).toBe(false);
    expect(
      ActionSchema.safeParse({ action: "check", since_s: 0 }).success,
    ).toBe(false);
  });

  it("rejects unknown extra fields (strict)", () => {
    expect(
      ActionSchema.safeParse({
        action: "sessions",
        bogus: true,
      }).success,
    ).toBe(false);
  });

  it("ACTION_NAMES matches schema branches", () => {
    expect(ACTION_NAMES).toEqual(["sessions", "send", "announce", "check"]);
  });
});

describe("ACTION_JSON_SCHEMA (model-facing)", () => {
  it("is a oneOf of one branch per action", () => {
    expect(ACTION_JSON_SCHEMA.oneOf).toBeDefined();
    expect((ACTION_JSON_SCHEMA.oneOf as unknown[]).length).toBe(4);
  });

  it("does not include anyOf (post-processed to oneOf)", () => {
    expect(ACTION_JSON_SCHEMA.anyOf).toBeUndefined();
  });

  it("does not include $schema (cleaner bytes for prompt cache)", () => {
    expect(ACTION_JSON_SCHEMA.$schema).toBeUndefined();
  });

  it("is byte-stable across imports (prompt-cache invariant)", async () => {
    const a = JSON.stringify(ACTION_JSON_SCHEMA);
    // re-import; node + bun cache modules so the same object comes back, but
    // we serialize independently to ensure no mutation crept in.
    const m = await import("../lib/action.ts");
    const b = JSON.stringify(m.ACTION_JSON_SCHEMA);
    expect(a).toBe(b);
  });

  it("each branch enforces its action discriminator as const", () => {
    for (const branch of ACTION_JSON_SCHEMA.oneOf as Array<Record<string, unknown>>) {
      const props = branch.properties as Record<string, { const?: string }>;
      expect(props.action.const).toBeDefined();
      expect(typeof props.action.const).toBe("string");
    }
  });
});

describe("TOOL_DESCRIPTION", () => {
  it("mentions every action", () => {
    for (const name of ACTION_NAMES) {
      expect(TOOL_DESCRIPTION).toContain(name);
    }
  });

  it("stays under 512B — terse surface for haiku-tier models", () => {
    expect(TOOL_DESCRIPTION.length).toBeLessThan(512);
  });
});

describe("parseAction", () => {
  it("returns ok=true for valid input", () => {
    const r = parseAction({ action: "sessions" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.action.action).toBe("sessions");
  });

  it("returns ok=false with human-readable errors", () => {
    const r = parseAction({ action: "send", to: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThan(0);
      expect(r.errors[0]).toContain("message");
    }
  });

  it("handles wrong-type discriminator", () => {
    const r = parseAction({ action: "nope" });
    expect(r.ok).toBe(false);
  });

  it("handles missing discriminator", () => {
    const r = parseAction({});
    expect(r.ok).toBe(false);
  });
});
