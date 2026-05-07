<!-- tested with: claude code v2.1.132 -->

# Changelog

All notable changes to the cc plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/anipotts/claude-code-tips/compare/v3.3.0...HEAD
[3.3.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.3.0
[3.2.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.2.0
[3.1.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.1.0
[3.0.0]: https://github.com/anipotts/claude-code-tips/releases/tag/v3.0.0
