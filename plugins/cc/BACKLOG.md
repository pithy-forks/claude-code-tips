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
+ auto-subscription problems that killed v1 topics:

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
