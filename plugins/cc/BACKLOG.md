<!-- tested with: claude code v2.1.121 -->

# cc plugin — backlog

Deferred work captured during the v3 imessage-alignment pass (PR #56).
Each item has the original conversation context noted so a future
Claude session can pick it up without re-deriving the rationale.

## naming: triple-cc repetition in MCP tool names

Tools currently surface as:

```
mcp__plugin_cc_cc__cc_sessions
mcp__plugin_cc_cc__cc_send
mcp__plugin_cc_cc__cc_announce
mcp__plugin_cc_cc__cc_check
mcp__plugin_cc_cc__cc_cleanup
```

Three stacked `cc`s: marketplace name (cc) + plugin name (cc) + tool
prefix (cc_). The marketplace+plugin doubling is intrinsic to Claude
Code's namespace (`mcp__plugin_<marketplace>_<plugin>__<tool>`); the
tool prefix is something we added on top.

**Easy fix (low risk):** drop the `cc_` prefix from tool names —
they become `sessions`, `send`, `announce`, `check`, `cleanup`. Final
shape: `mcp__plugin_cc_cc__sessions`. Still has the cc_cc but at
least no triple. Mirrors imessage's pattern: imessage's tools are
`reply` and `chat_messages`, not `imessage_reply`.

**Bigger fix (breaking):** rename the marketplace from `cc` to
something distinct (e.g. `tips`, `potts`, `cck`). Install command
becomes `cc@tips` instead of `cc@cc`. Breaks every doc + every
existing user's `enabledPlugins` entry. Not worth the churn unless
we're doing a v4 rebrand anyway.

Decision context: user flagged this as "ugly naming" while reading
the post-install instructions. Acknowledged + backlogged for after
v3 ships.

## per-project mesh (decision 16-B from PR #56)

Today `~/.claude/channels/cc/sessions.db` is global — every CC
session on this Mac, across every project, sees every other.

Goal: scope the mesh to "same project" by default, with `--global`
opt-in to widen.

Approach sketch:
- A new `project_id` column on sessions (already added the
  `project_root` column in commit 6 for the file-overlap detector).
- Default queries (cc_sessions, cc_check) filter peers to those
  whose `project_root` matches mine.
- New env var `CC_SCOPE=project|global|machine` (default project)
  controls the filter. cc_sessions accepts `scope=` arg to override
  per-call.

Open question (research backlog): what's the right default? On a
power-user setup where I run multiple sessions in the same project
all the time, project-scope is what I want. On the rare occasion
I want to coordinate across projects (e.g. lore session asking cc
session for help), global. The 80/20 says project-default. But I
should validate this with actual usage data once cc starts producing
some.

## cross-machine mesh (decision 17 — backlog priority)

Today: one Mac only. ap-pro and ap-mini sessions don't see each other.

Backlog approach when ready:
- The sqlite db at `~/.claude/channels/cc/sessions.db` can be
  rsync'd over Tailscale, but rsync is the wrong shape for live
  awareness.
- Better: a small worker on ap-mini that watches its local
  sessions.db for changes and replicates to peers via Tailscale.
  Litestream would do this if we wanted.
- Even simpler: Cloudflare D1 + a tiny Worker that proxies
  cc_send / cc_check across machines. No local sqlite replication.
  Plays well with the brands_emails D1 migration anipotts.com is
  doing.

Open question: do peer sessions on different machines need to see
each others' file overlaps? Probably not — file paths don't make
sense across machines. Cross-machine awareness is mostly "another
me is working on X over there" + DM. Drop the file-overlap detector
in cross-machine mode.

## topics v2 (deferred from commit 5)

The schema retains topics/subscriptions tables; the user surface is
currently DM-only. Future opt-in topic UX should solve the discovery
and auto-subscription problems that killed v1 topics:

1. **Auto-derived topics:** every session in `~/Code/active/<proj>`
   auto-subscribes to `#<proj>`. No user typing.
2. **Topic discovery surface:** `cc_topics` tool listing topics with
   active subscribers + recent activity, so the model can join
   what's relevant.
3. **Topic-style fan-out for announcements:** `cc_announce` could
   accept `to_project` or `to_branch` instead of arbitrary strings.

Validate against real usage data before designing -- v1 topics
shipped without that and were never used.

## agentic conflict primitives v2 (deferred from commit 6)

The v3 file-overlap detector is `same path AND (same branch OR same
worktree)`. Real agentic CC conflicts that v3 doesn't cover:

| conflict | primitive needed |
|---|---|
| both running dev server on same port | `ports` table tracking who has port N bound |
| both running tests vs shared DB | `db_handles` table tracking which session has which DB connection |
| both rebasing/pushing same remote branch | `git_locks` table; integration with `git rev-parse --is-inside-git-dir` checks |
| `.git/index.lock` ownership | filesystem lock-file watcher |
| long-running shell processes | `processes` table fed by hooks on Bash tool calls |

Each one wants its own primitive. Not blocking shipping v3, but
worth a coherent v4 design pass once we have data on which conflicts
happen most in practice.

## future rename verb (decision 19)

Currently sessions.name is nullable + never auto-populated. To
re-enable user-set names without a migration:

1. Add `cc_rename` tool that updates `sessions.name`.
2. resolveSessionTarget() already tries `name` first via the
   existing query column, so renames "just work" once the verb
   lands.
3. Display `<name>` instead of `<short-id> @ <cwd-basename>` when
   name is non-null in the digest.

Trivial to add; deferred until someone actually wants it.

## machine-like configurability research (decision 12 backlog)

The user flagged a deeper research session for "different strategies
of designing machine-like configurability." Today cc has env-var
config for runtime knobs (CC_STATE_DIR, CC_HEARTBEAT_MS, etc.) but
no first-class config system. Possible directions:

- A `cc_config` tool that reads/writes a per-machine config file.
- Project-level `.cc.json` (gitignored?) for per-repo overrides.
- A `static` mode (already declared as `CC_STATIC_MODE`, not yet
  wired) that pins all config to boot-time values + refuses runtime
  mutation. Imessage has this for security; cc could use it for
  predictability across long sessions.

Open until we have a clear use case driving the design.

## stale orphans

PID 94652 (`bun server.ts`, no path on argv) — survived smoke testing
on 2026-04-28. Sandbox refused SIGKILL since the pid wasn't
DB-verified. Will die naturally on user's next CC restart.

---

**CC 2.1.121 changelog adoption — items deferred from PR.** The PR
shipping `alwaysLoad`, the README cascade docs, and the MCP auto-retry
note also surfaced these. Captured here so a future session can pick
them up with full rationale.

## [CC 2.1.121] monitors manifest — needs investigation

CC 2.1.121 added a `monitors` array to plugin manifests. The initial
plan was to extract cc's inbox watcher (currently `fs.watch(myInbox,
...)` in `server.ts`, ~line 1148) into a separate `monitor.ts`
process and register it via `monitors`. **Don't ship this without
verifying the contract first.**

Why it's risky as planned: the watcher today calls
`server.notification({ method: "notifications/claude/channel", ... })`
which writes to the open stdio MCP transport CC is reading on the
other side. That transport only exists in the running MCP server
process. A separate monitor process would have no handle to it.

What to verify before refactoring:

1. Does a `monitors` entry communicate back to CC via stdout (hook-
   style), via a different IPC channel, or via something that lets it
   push into a *running* MCP session?
2. If it's hook-style only, then the inbox watcher cannot be moved
   without losing the Tier 2 `--channels` push path. Need a different
   primitive.
3. If `monitors` does support pushing to an MCP server's open
   transport, we still need to confirm message delivery semantics
   (in-order, at-least-once, delivery during the parent CC's idle
   periods, etc.).

Until verified, the `fs.watch` lives in server.ts and Tier 2 push
keeps working.

## [CC 2.1.105] PreCompact hook to protect cc-active sessions

CC 2.1.105 introduced a `PreCompact` hook that fires before automatic
compaction. cc could register one that decides whether to skip
compaction this turn — e.g., if there's an unread DM in the digest
or a peer has flagged file-overlap, hold off so the user sees the
context before it gets summarized away.

Considerations:
- Has to be near-instant; PreCompact runs synchronously.
- Returning a "skip compact" signal too aggressively defeats the
  purpose of compaction. Right answer probably: skip only if a peer
  is actively *blocking* on us (urgency=question or file-overlap).
- Wire through cc.check with an `is_blocking_present` boolean, then
  the PreCompact hook just queries that.

## [CC 2.1.120] ${CLAUDE_EFFORT} for digest verbosity

CC 2.1.120 exposes `${CLAUDE_EFFORT}` (low/medium/high) as a hook env
var. cc.check could vary digest verbosity by effort: at low, only
direct messages; at medium, current digest; at high, include peer
file-recency tail and the file-overlap matrix. Saves tokens on
short-burst sessions where the user just wants a fast yes/no.

## [CC 2.1.117] Include cc state dirs in cleanupPeriodDays

CC 2.1.117 added a `cleanupPeriodDays` setting that retention-sweeps
plugin data dirs. cc currently keeps inbox/topics/questions
indefinitely under `~/.claude/channels/cc/`. Hook into the same
config (or a cc-specific override) so old messages get pruned on the
same schedule.

Implementation: a daily-or-on-startup pass that deletes .msg files
older than the configured window from `inbox/<sid>/` and
`topics/<topic>/`. Sessions table rows already have an `ended_at`
column; sweep ended sessions whose `ended_at` exceeds the window.

## [CC 2.1.119] Use duration_ms from PostToolUse for recent_files weighting

CC 2.1.119 enriches PostToolUse hook payloads with `duration_ms`. cc's
file-recency surface today treats every Edit/Write as a flat point.
With duration_ms we can weight by tool-call cost: a 30-second
formatting pass on a file matters less than a 4-minute targeted
refactor. Future digest could surface the *expensive* recent files
not just the *recent* ones.

Wire-up: PostToolUse hook captures (tool, file, duration_ms),
inserts into a `tool_calls` table, the digest renderer reads weighted
recency.

## [CC 2.1.97] Skill description token cap raised 250 to 1536

If we ever convert any `/cc:*` commands to skills (currently they're
slash commands that call MCP tools), the higher description token
cap means we can ship richer auto-trigger guidance without truncation.
No action today; relevant only if the commands→skills migration
happens.

## [CC 2.1.110] Push notifications via Notifications tool

CC 2.1.110 added system-level push notifications via the
`Notifications` tool. cc could surface urgent peer DMs (urgency =
question or blocked) as macOS notifications even when the agent isn't
actively reading the digest. Useful for parallel-session workflows
where the user is reading one CC pane while another is waiting on a
peer response.

Considerations:
- Don't notify on every announcement. Filter to urgency >= question.
- Rate-limit: at most one notification per peer per 5 minutes.
- macOS focus modes already gate notifications; respect them.
