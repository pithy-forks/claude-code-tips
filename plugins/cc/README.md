<!-- tested with: claude code v2.1.118 -->

# cc

session mesh for claude code. like email cc: every session on your machine
stays informed of what its siblings are doing, and you see what they're doing,
so two agents never silently clobber the same file. zero-token when quiet,
200-400 tokens of real cross-session awareness when active.

also ships the `time` subsystem (a rule, a hook, three `/time-*` skills) from
the v1 plugin, unchanged.

## install

```
/plugin marketplace add anipotts/claude-code-tips
/plugin install cc@cc
```

zero configuration. works on macos, linux, wsl.

**runtime:** [bun](https://bun.sh) 1.1+. install with `curl -fsSL https://bun.sh/install | bash` (~15s, one-time). bun replaces node + tsx + better-sqlite3 with a single binary; cold-start is ~13× faster and there is no native-module compile step.

## quickstart

```
/cc:sessions                                 list other sessions on this machine
/cc:sessions send <name> "hello"             direct message; recipient sees it on next turn
/cc:sessions announce "refactoring auth"     broadcast a status update; peers see it in their digest
/cc:sessions subscribe #auth                 join a topic
/cc:sessions send --topic=#auth "..."        broadcast to topic subscribers
```

## how awareness works (the gmail-cc metaphor)

cc is the email cc line for claude code sessions. you're *informed*, not
*obligated*. when another session does something relevant, you see it in
context when you start your next turn. you decide whether to act.

every turn fires `UserPromptSubmit`. cc's hook calls the mcp server there,
which returns an awareness digest: direct messages, topic activity, peers'
recent file activity, and file-overlap alerts. only new items since your
last check are surfaced (delta semantics). empty digests are skipped.

the digest looks like:

```
cc digest (3 other sessions active)

direct:
- merizo (4m, question) "30d vs 90d refresh?": auth refactor, legal wants shorter window...

topic #auth (2 new):
- quantercise (3m) "merged 30-day branch"

activity:
- merizo @ ~/repo-a (src/auth.ts, src/tokens.ts): refactoring session storage [7m]
- quantercise @ ~/repo-b (lib/deploy/staging.ts): investigating failed CF deploy [12m]

file overlap:
- src/auth.ts: also touched by merizo within 8m. coordinate via /cc:sessions send merizo
```

active turn cost: ~200-400 tokens. quiet turn cost: 0 tokens.

## verbs

| verb | does |
|---|---|
| `sessions` | list live sessions (id, name, cwd, role, topics, recent_files, last_seen) |
| `send` | direct message or topic broadcast. fields: `to`, `topic`, `message`, `subject`, `urgency` (`low`/`normal`/`urgent`/`question`), `meta` |
| `announce` | voluntary status broadcast. peers see it in their `check` digest. fields: `summary`, `detail`, `topics` |
| `check` | awareness digest (structured + rendered). delta-semantics by default; `since_s` forces lookback |
| `subscribe` | join a topic (e.g. `#auth`). optional `role` tags your session |
| `unsubscribe` | leave a topic |
| `cleanup` | deregister self (called by `SessionEnd` hook) |
| `ask` / `answer` | scaffolded; wired in 2.1.0. use `/cc:sessions send` with `urgency: question` for now |

## file-overlap alerts (the killer feature)

the mcp server passively reads your own session transcript and publishes the
last ~10 files your tools touched into `sessions.db`. when any other session
has touched a file you've touched within the last ~10 minutes, your next
digest surfaces an alert. this is what stops two claude code sessions from
silently clobbering each other's work.

no PostToolUse hook. no extra tokens inside the conversation. the transcript
read is filesystem-level and never enters your context.

## hooks

| event | calls | why |
|---|---|---|
| `SessionStart` | `cc check` (mcp_tool) | inject initial digest; register presence |
| `UserPromptSubmit` | `cc check` (mcp_tool) | primary awareness surface, before each user turn |
| `SessionEnd` | `cc cleanup` (mcp_tool) | tombstone session, remove inbox |

three hooks, not four. `Stop` is deliberately not used because claude code
only injects `additionalContext` on six events, and `Stop` is not one.
messages arriving during an assistant turn surface on the *next* user
prompt, which matches the email-cc metaphor (you check email when you check
email, not mid-keystroke).

all three hooks use `type: "mcp_tool"` from claude code v2.1.118: the hook
calls the mcp server's `cc` tool directly. no shell shim, no node shim.

## realtime push (tier 2, opt-in)

by default cc is pull-only. if you want inbound direct messages to land
mid-turn rather than at the next prompt, launch claude with `--channels`:

```bash
alias claude-cc-live='claude --channels'
claude-cc-live
```

trade-off: claude code disables plan mode and `AskUserQuestion` while
`--channels` is active (per v2.1.117). most users should leave this off
and stay on tier 1 (pull), where every deferred tool works normally. the
mcp server supports both modes from the same install; there is no code
change to switch.

## structure

```
plugins/cc/
├── .claude-plugin/plugin.json
├── server.ts                       mcp server, 7 verbs + 2 scaffolded
├── db/
│   ├── schema.sql                  6 tables: sessions, topics, subs, recent_files, announcements, questions
│   └── migrate.ts                  opens db, applies schema
├── lib/
│   ├── render.ts                   Digest → additionalContext text
│   └── transcript-tail.ts          watches own transcript, publishes recent_files
├── hooks/hooks.json                3 mcp_tool hooks (SessionStart, UserPromptSubmit, SessionEnd)
└── commands/sessions.md            /cc:sessions slash command
```

state at `${CLAUDE_CONFIG_DIR:-~/.claude}/cc/`:

```
sessions.db            sqlite metadata (wal mode)
inbox/<sid>/           direct-message files (atomic rename)
topics/<t>/            topic-message files (atomic rename)
questions/             2.1.0, scaffolded
```

messages bodies stay on filesystem so directory-based delivery still works
if sqlite is unavailable. metadata is sqlite so concurrent writes from many
sessions converge safely.

## troubleshooting

- **no digest shows up:** check that the plugin is enabled (`/plugin` menu).
  if your cc state dir didn't exist, it's created on first launch; run any
  tool that loads the mcp server, then try `/cc:sessions`.
- **"session X not found":** recipient session needs cc enabled and must be
  live (heartbeat every 30s). use `/cc:sessions` to see what's live.
- **session name shows as 8-char id:** cc pulls the native session name from
  `~/.claude/sessions/<pid>.json` when available; falls back to `basename(cwd)`
  otherwise.
- **plan mode is missing when running `--channels`:** expected. tier 2
  trade-off. switch back to default `claude` launch for tier 1 behavior.
- **file-overlap alerts empty even though two sessions are editing the same
  file:** the transcript-tail watcher needs ~10-15s after a tool call to
  publish the file path. very fast back-and-forth edits may race.
- **sqlite database corrupted:** remove `${CLAUDE_CONFIG_DIR:-~/.claude}/cc/sessions.db*`
  and restart any session; schema is recreated.

## upgrading from cc 2.x

if you used `/cc:time-estimate`, `/cc:time-calibrate`, `/cc:time-benchmark`, or the SessionStart project-timing hint, those moved out of cc into a focused `time` plugin in this same marketplace. install it with:

```
/plugin install time@cc
```

cc 3.0 is **session mesh, period.** email-cc semantics for agents.

## rollback

```
/plugin uninstall cc
```

no user-settings changes to reverse.
