// tested with: claude code v2.1.122
/**
 * cc verb surface — single source of truth.
 *
 * The MCP tool exposes one tool ("cc") with action-discriminated args.
 * Adding/removing/renaming a verb means editing this file and nothing else;
 * the dispatcher's exhaustive switch in server.ts will refuse to compile if a
 * verb is missing a branch.
 *
 * Why a discriminated union (not 5 tools): byte-stable across sessions, so
 * Anthropic's prompt cache hits across every session that uses cc within the
 * 5-min TTL window; subagent contexts pay one tool's worth of schema bytes
 * instead of five; tool-list response is a single JSON Schema with `oneOf`
 * branches that the model navigates by the `action` discriminator.
 */

import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

// --- args schema (zod, single source of truth) ------------------------------

const urgencySchema = z.enum(["low", "normal", "urgent", "question"]);

export const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("sessions"),
      include_self: z
        .boolean()
        .optional()
        .describe("include your own session in the result (default false)"),
    })
    .strict(),

  z
    .object({
      action: z.literal("send"),
      to: z
        .string()
        .min(1)
        .describe("target peer: short id (8 hex), full session id, or cwd basename"),
      message: z.string().min(1).describe("message body the recipient will read"),
      subject: z.string().optional().describe("optional one-line subject"),
      urgency: urgencySchema
        .optional()
        .describe("priority hint; default normal. 'question' signals a reply is expected"),
      meta: z
        .record(z.unknown())
        .optional()
        .describe("optional structured metadata; recipient can read this verbatim"),
    })
    .strict(),

  z
    .object({
      action: z.literal("announce"),
      summary: z.string().min(1).describe("one-line status broadcast (required)"),
      detail: z.string().optional().describe("optional longer body"),
    })
    .strict(),

  z
    .object({
      action: z.literal("check"),
      since_s: z
        .number()
        .positive()
        .optional()
        .describe("lookback window in seconds; defaults to since-last-check"),
    })
    .strict(),
]);

export type Action = z.infer<typeof ActionSchema>;
export type ActionName = Action["action"];

export const ACTION_NAMES: readonly ActionName[] = [
  "sessions",
  "send",
  "announce",
  "check",
] as const;

// --- MCP tool description ---------------------------------------------------
//
// One tool, four actions. The action enum is the model's first decision; each
// branch's args are validated by the discriminated union at call time. We
// intentionally narrate WHEN to pick each verb here (not just WHAT it does),
// since the SKILL.md covers the same ground for the skill-triage model.
export const TOOL_DESCRIPTION =
  "Coordinate with peer Claude Code sessions on this machine via the cc " +
  "session mesh. One tool, four actions:\n" +
  "  action='sessions' — list live peers (short id, cwd, recent files, last seen)\n" +
  "  action='send' — direct-message one peer (urgency='question' if you need a reply)\n" +
  "  action='announce' — broadcast a status update visible to all peers' next digest\n" +
  "  action='check' — pull the awareness digest (peers' recent files, file overlaps, unread DMs)\n" +
  "Channel push notifications cover realtime DM arrival; you don't have to call check on every turn.";

// --- pre-built JSON Schema (cached at module load) --------------------------
//
// Computed once when this module is first imported. Identical bytes across
// every session and every subagent for prompt-cache stability. Stripping the
// $schema field shaves ~50B and removes a meta key the MCP client ignores.

const _raw = zodToJsonSchema(ActionSchema, {
  $refStrategy: "none",
  target: "jsonSchema7",
});

// zod-to-json-schema wraps the result in {$schema, ...rest}. We want the rest.
const { $schema: _drop, anyOf: _branches, ...stripped } = _raw as {
  $schema?: string;
  anyOf?: unknown[];
} & Record<string, unknown>;

// Discriminated unions SHOULD use `oneOf` per JSON Schema 2020-12 + OpenAPI.
// Some MCP clients treat `anyOf` permissively (multi-branch match) whereas
// `oneOf` is exclusive -- closer to the discriminated-union semantic.
const withOneOf =
  _branches !== undefined ? { ...stripped, oneOf: _branches } : stripped;

export const ACTION_JSON_SCHEMA = withOneOf as Record<string, unknown>;

// --- runtime helpers --------------------------------------------------------

/**
 * Parse + validate an inbound MCP tool-call argument blob.
 * Returns either a typed Action or a list of human-readable error strings.
 */
export function parseAction(
  raw: unknown,
): { ok: true; action: Action } | { ok: false; errors: string[] } {
  const parsed = ActionSchema.safeParse(raw);
  if (parsed.success) return { ok: true, action: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => {
      const path = i.path.length ? i.path.join(".") + ": " : "";
      return path + i.message;
    }),
  };
}
