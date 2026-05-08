<!-- tested with: claude code v2.1.133 -->

# fresh-install runbook

manual procedure to verify cc behaves correctly when a new user installs
it for the first time. exercises the path the synthetic eval harness can't:
slash-command dispatch, plugin manager, MCP tool registration, hook
auto-discovery, the cold-start mesh.

## why this isn't automated

`bun eval/run.ts` drives cc-server directly via stdio. it doesn't run
under Claude Code, so:
- `/plugin install`, `/reload-plugins`, `/cc` slash commands aren't reachable
- the SessionStart and PostToolUse hooks aren't dispatched by the harness
- the MCP `tools/list` registration in the parent claude isn't exercised

the runbook below covers those by running real Claude Code sessions.

## prerequisites

- Claude Code v2.1.133 or later (`claude --version`)
- bun installed (`bun --version`)
- `gh` CLI authenticated against github.com

## procedure

### step 1: capture a clean baseline

```bash
# fresh tmpdir for everything
WORKDIR=$(mktemp -d)
cd "$WORKDIR"
echo "WORKDIR=$WORKDIR"

# isolated CLAUDE_CONFIG_DIR — no plugin, no settings, no state to start
export CLAUDE_CONFIG_DIR="$WORKDIR/.claude"
mkdir -p "$CLAUDE_CONFIG_DIR"

# clone the marketplace
gh repo clone anipotts/claude-code-tips "$WORKDIR/marketplace"
```

### step 2: install via claude

drop into a fresh interactive claude session in this isolated dir:

```bash
cd "$WORKDIR"
CLAUDE_CONFIG_DIR="$WORKDIR/.claude" claude
```

then inside claude:

```
/plugin marketplace add ./marketplace
/plugin install cc@claude-code-tips
/reload-plugins
```

after `/reload-plugins`:
- `/plugin` should list cc@claude-code-tips, version 3.5.0+
- new `~/.claude/channels/cc/sessions.db` should exist (this is your
  isolated `$CLAUDE_CONFIG_DIR/channels/cc/`, not the global one)

```bash
# check from another terminal:
sqlite3 "$WORKDIR/.claude/channels/cc/sessions.db" \
  "SELECT id, cwd, branch, last_seen_at_ms FROM sessions;"
```

you should see 1 row — the session you just installed in. that proves:
- the plugin's MCP server booted
- self-register ran during boot
- the SessionStart hook wrote the row (or the server self-register did;
  both paths are idempotent UPSERTs)

### step 3: verify cc tool surface

inside the same claude session:

```
/cc
```

expected output: a roster table with at least your own session listed.
**not** "(no content)" — that was the v3.4 cold-start bug we fixed.

if you see `[no cc]` markers next to peers, those are CC sessions that
exist (`~/.claude/sessions/<pid>.json`) but haven't loaded the cc plugin
yet. they need `/reload-plugins` in their own terminal.

### step 4: trigger the PostToolUse hook

```
edit a file: bash heredoc to /tmp/foo.txt with some content
```

then check `recent_files` was written:

```bash
sqlite3 "$WORKDIR/.claude/channels/cc/sessions.db" \
  "SELECT session_id, path, touched_at_ms FROM recent_files ORDER BY touched_at_ms DESC LIMIT 5;"
```

you should see a row for the file you just edited. if not:
- the PostToolUse hook may not be registered (check `/hooks` inside claude)
- `bun ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.ts` may have failed silently
  (check `~/.claude/logs/` if it exists)

### step 5: open a SECOND claude session

in another terminal (still with the same `CLAUDE_CONFIG_DIR`):

```bash
CLAUDE_CONFIG_DIR="$WORKDIR/.claude" claude
```

inside the new session, run `/cc`. your FIRST session should appear in
the roster as a peer.

if it doesn't: the SessionStart hook didn't fire (the second session
isn't registered) OR `liveSessions()` isn't seeing the native session
file. check:

```bash
ls "$WORKDIR/.claude/sessions/"
# should have 2 *.json files (one per running claude)
```

### step 6: send a DM between sessions

from session A:

```
tell <short-id-of-B> "hello from session A"
```

session B should receive a channel push notification within ~50ms. its
next `/cc` call should show the DM in `direct:`.

### step 7: enable verbose tracing

if any step above misbehaves, restart claude with verbose tracing:

```bash
CC_DEBUG=1 CC_TRACE_SQL=1 CLAUDE_CONFIG_DIR="$WORKDIR/.claude" claude
```

cc-server stderr will now emit `[cc.trace] ts=... phase=... ms=...`
lines for every action call. these get captured in `~/.claude/logs/` if
your claude version writes mcp child logs there; otherwise tail the
parent claude's stderr.

key phases to watch:
- `phase=boot` — should land within 50ms of plugin load
- `phase=action.dispatch` — every cc tool call
- `phase=sql.liveSessions` — should be sub-1ms; >50ms suggests db lock contention
- `phase=action.error` — surfaces caught exceptions

### step 8: tear down

```bash
# kill any cc-server processes still running for this CLAUDE_CONFIG_DIR
pgrep -f "$WORKDIR/marketplace/plugins/cc/server" | xargs kill 2>/dev/null

# remove the workdir entirely
rm -rf "$WORKDIR"
```

## what "passing" looks like

| step | acceptance |
|---|---|
| 2 | `/plugin` lists cc@claude-code-tips · sessions.db has 1 row |
| 3 | `/cc` shows your session, no error noise |
| 4 | recent_files table has the edited path |
| 5 | second session appears in first session's `/cc` roster |
| 6 | DM pushes within ~50ms; visible in receiving session's check |
| 7 | trace lines visible under CC_DEBUG=1 |

## known issues

- on first install, `/cc` in the install-trigger session may report tool
  unavailable. claude code spawns the MCP server but doesn't always re-poll
  `tools/list` for the running session. workaround: restart that one
  terminal. all other sessions then work without further action. fixed in
  v3.5+ on CC's side as the OAuth race + tools/list retry land.
- if `~/.claude/sessions/*.json` files persist after the parent claude
  exits (dirty shutdown), `liveSessions` filters them out via
  `kill -0 <pid>` — stale entries don't appear in roster.
