<!-- tested with: claude code v2.1.132 -->

# Changelog

All notable changes to the cc plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.7.0] — 2026-05-08

### Removed (pre-v3 + dead code purge)
- `LEGACY_TOOL_NAMES` map (cc_sessions/cc_send/cc_announce/cc_check
  pre-v3 per-verb tool names). Single tool surface (`cc` with action arg)
  has been canonical since v3.0.
- `migrateLegacyStateDir` + `LEGACY_CC_DIR` const + import. Pre-v3
  `~/.claude/cc/` → `~/.claude/channels/cc/` migration. Anyone on v2 has
  long since upgraded.
- `STATIC_MODE` env var. Declared but never enforced anywhere.
- `subscriptionsFor()` function. Read the legacy v2 `subscriptions` table
  but had zero callers in v3+.
- `topic_unread` field from the `Digest` type + the entire topics
  rendering branch in `lib/render.ts`. Was hardcoded to `{}` in
  `computeDigest` since v3.0; the topics surface was dropped from the
  user-facing actions.
- `questions_awaiting_me` + `my_open_questions` fields from the `Digest`
  type. Both were always-empty arrays since v3.0; questions surface
  was deferred indefinitely.
- `TopicMsg` and `QuestionAwaitingMe` types from `lib/render.ts`.
- The `low drops topic_unread previews` test (the feature it tested no
  longer exists).

### Why
Zero users — no need for backwards compatibility. Removing dead code is
strictly easier than maintaining it. ~165 LOC delete, 14 LOC added,
net -150. Tests: 44 → 43 (one test removed alongside its surface).

## [3.6.0] — 2026-05-08

### Added
- **`bin/cc-quick` — direct cc state access without MCP.** Bash + sqlite3
  helper that reads `~/.claude/channels/cc/sessions.db` and writes
  `inbox/<sid>/*.msg` files atomically. Always works regardless of MCP
  tool registration state. Verbs: `roster`, `send`, `announce`, `check`,
  `mine`. ~150 LOC, no dependencies beyond `bash`/`sqlite3`/`uuidgen`.

### Changed
- **`SKILL.md` reframes the path hierarchy.** sqlite + filesystem direct
  access is now the FAST PATH, not a fallback. MCP is documented as
  the typed/validated path that's optimal when available but never
  required. Each verb explicitly lists which path is faster.
- **`send` no longer requires MCP.** The recipient's cc-server
  `inbox-watch` FSWatcher dispatches the channel push notification on
  ANY new `.msg` file landing, regardless of who wrote it. Direct
  bash writes via `cc-quick send` produce identical recipient-side
  behavior to MCP send.

### Why
Real-world feedback: in the install-trigger session (the terminal that
ran `/plugin install`), the cc MCP tool isn't reachable until that
terminal restarts (CC harness doesn't re-poll `tools/list` mid-session).
The previous SKILL.md framed sqlite as a "fallback" which made users
feel the install-trigger session was second-class. v3.6 treats both
paths as first-class with explicit per-verb routing.

## [3.5.0] — 2026-05-08

### Added
- **#68 — digest verbosity by `$CLAUDE_EFFORT` (CC 2.1.133+).** `cc(action='check')`
  output now tunes by the active effort level read from `process.env.CLAUDE_EFFORT`:
  - `low` — single-line peers, no summary parenthetical, topic_unread titles only,
    message previews capped at 80 chars.
  - `medium` (default) — current shape; `<short> <branch> · <summary> (<age>)`.
  - `high` — adds an `edits: <recent files>` line per peer, message previews up
    to 240 chars, full announce body.
- **Observability via `CC_DEBUG=1`** — emits structured stderr trace lines at boot,
  action dispatch, and on action errors. Format: `[cc.trace] ts=<ms> sid=<short> phase=<name> ...`.
  Zero overhead when off.
- **`CC_TRACE_SQL=1`** — wraps the `liveSessions` query (the hottest read path) with
  timing under `phase=sql.liveSessions`. More query coverage in subsequent PRs.

## [3.4.0] — 2026-05-07

### Added
- **Wave C subscriptions** — declarative match rules. Two new verbs:
  `cc(action='subscribe', { files?, peers?, urgency_min? })` returns an
  id; `cc(action='unsubscribe', { id })` removes. Each cc call now also
  computes `subscription_matches` against the caller's subs and includes
  the matching events alongside `digest_delta`. Without subs, the field
  is omitted; with subs the model can prioritize matches without an
  extra query.
- **`cc_subs` table** in the schema. Idempotent CREATE; legacy v2
  `subscriptions` (topic-based) stays dormant for back-compat.
- **Glob matcher** — `**` for any depth, `*` for single segment, `?`
  for single char. Path matching only (DM matching uses urgency_min).

### Changed
- `TOOL_DESCRIPTION` lists the two new verbs.
- ACTION_NAMES bumped from 4 to 6. Schema bytes change once on `tools/list`
  (one prompt-cache invalidation), then byte-stable.
- `cleanupSelf()` also drops the session's `cc_subs` rows on shutdown.

## [3.3.0] — 2026-05-07

### Added
- **Wave A.6** — Cold-start UX. `liveSessions()` reads
  `~/.claude/sessions/*.json` (CC's native service-discovery layer) +
  `process.kill(pid, 0)` liveness check, merges with cc's sessions table.
  Native-only peers (cc plugin not wired in their terminal yet) surface
  with `cc_loaded=false`.
- **Wave A.6** — SessionStart hook (`hooks/session-start.ts`) registers
  every session in cc's table at session start. Idempotent UPSERT — both
  the hook and the cc MCP server's boot path write the row.
- **Wave A.6** — Per-cwd `project_root` cache for native-only peers, so
  scope filtering works without forking a git invocation per peer per call.
- **Wave A.6** — `cc_loaded` flag on each peer in `cc(action='sessions')`
  and rendered digests; `(N cc-loaded, M need /reload-plugins)` header
  when both kinds present.
- **Wave B** — Peer intent summary in roster + digest. Each peer carries
  `branch`, `summary` (one-line synthesis: latest <30min announcement,
  else most-recent-touched file basename, else "(idle)"),
  `last_announce_age_s`, `last_edit_age_s`. Renderer formats as
  `abcd1234 main · auth.ts (3m ago)` instead of just `abcd1234 @ repo`.
- **Wave B** — Piggyback `digest_delta` on every action call. When
  `cc(action='sessions'|'send'|'announce')` runs, the response includes
  a `digest_delta` block listing new announcements, edited files, peer
  joins, and peer leaves since the caller's last cc call. Once a delta
  has been observed, `last_checked_at_ms` advances so subsequent calls
  don't replay the same events. Zero new infrastructure — no FSWatcher,
  no relay file, no new hook. Trade-off: delta only fires on the caller's
  next cc call (vs. true push); acceptable for v1.

### Changed
- `TOOL_DESCRIPTION` leads with disambiguating tokens (`Claude Code session
  mesh, peer messaging, multi-agent coordination`) so `ToolSearch` matches
  on those phrases. Bare `cc` was colliding with Slack mention syntax, MCP
  server prefixes, and AWS service codes.
- `SKILL.md` gains an "After a fresh install" section explicitly naming the
  CC-doesn't-re-poll-tools/list constraint and the workaround. Updated
  for the v3.3 `digest_delta` return shape on every cc call.
- `readGitContext` `project_root` regex handles bare `.git` returned by
  `git rev-parse --git-common-dir` when cwd IS the repo root. Previously
  computed `cwd/.git` instead of `cwd`. SessionStart hook uses the same fix.

## [3.2.0] — 2026-05-07

### Added
- `PostToolUse` hook (`hooks/post-tool-use.ts`) writes `recent_files` rows
  via parameterized `bun:sqlite` queries. Replaces the in-process
  transcript-tail FSWatcher (~194 LOC). Hook also writes `last_seen_at_ms`
  defensively so edit-only sessions stay live in the roster.
- `cleanupPeriodDays: 7` declared in plugin manifest, retiring the implicit
  `MSG_TTL_MS` sweep responsibility.

### Removed
- `lib/transcript-tail.ts` (~194 LOC) — superseded by the PostToolUse hook.
  Architectural shift: `recent_files` writes leave cc's MCP server entirely
  and run via CC's hook surface.

### Closed issues
- #69 (recent_files via PostToolUse), #70 (cleanupPeriodDays)

## [3.1.0] — 2026-05-07

### Added
- Per-project scope default for `sessions` and `check`. Opt-in
  `scope='global'` restores v3 behavior.
- Lazy heartbeat: `last_seen` + git context refresh on every action call
  and on every transcript-tail `readDelta`.
- `oneOf` schema for the discriminated union (was `anyOf`). External
  contribution from @mvanhorn (#94).

### Changed
- `TOOL_DESCRIPTION` trimmed 570 → 276 chars; `SERVER_INSTRUCTIONS` trimmed
  700 → 312 chars. Routing detail moved to `SKILL.md`. Security guards
  (prompt-injection + exfil) stay.

### Removed
- 30s heartbeat `setInterval` — replaced by lazy refresh on activity.

### Closed issues
- #74 (per-project scope), #82 (oneOf schema)

## [3.0.0] — 2026-04-28

### Added
- Single MCP tool (`cc`) with action-discriminated args (was 5 tools). Schema
  is byte-stable across sessions for prompt-cache hits.
- Skills/sessions/SKILL.md replaces the slash-command surface for the verb
  routing; the slash command is gone.
- Channel push notifications (`claude/channel`) for inbox arrivals.
- `bun:sqlite` runtime (was `better-sqlite3` on Node).
- `~/.claude/channels/cc/` state-dir convention (was `~/.claude/cc/`); legacy
  path migrates automatically with a backwards-compatible symlink.

### Removed
- Topic verbs (`subscribe`, `unsubscribe`) — superseded by future
  subscriptions plan.
- Per-pid heartbeat metadata writes from cc to `~/.claude/sessions/*.json`
  (cc reads, never writes; CC owns that directory).

### Closed issues
- Prior issues tracked in `BACKLOG.md` (now removed; tracked on GitHub).

[Unreleased]: https://github.com/anipotts/claude-code-tips/compare/v3.4.0...HEAD
[3.4.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.4.0
[3.3.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.3.0
[3.2.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.2.0
[3.1.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.1.0
[3.0.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.0.0
