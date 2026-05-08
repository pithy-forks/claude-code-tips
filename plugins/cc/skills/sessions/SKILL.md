---
name: sessions
description: |
  See active Claude Code sessions on this machine and coordinate across them
  via direct messages, status announcements, and file-overlap awareness.
  Triggers when the user asks "who else is running?", "any other claude open?",
  "what other sessions are active?", "tell <name> to ...", "ping <peer>",
  "let peers know I'm doing X", "broadcast <status>", "check the cc digest",
  or any cross-session / multi-agent coordination on this machine.
model: haiku
---
<!-- tested with: claude code v2.1.133 -->

# cc — session mesh

cc has TWO equivalent invocation surfaces. Both go to the same sqlite +
filesystem state. Pick the fast one for the verb you're running.

## The fast path (always reliable)

cc state lives in `~/.claude/channels/cc/`:
- `sessions.db` — peer roster, recent_files, announcements, subscriptions
- `inbox/<sid>/*.msg` — direct messages (any new file triggers recipient's
  push notification via their cc-server's FSWatcher)

The fast path reads/writes that state directly via `sqlite3` + atomic file
writes. Works in **every** session including the install-trigger one,
regardless of whether the cc MCP tool registered. ~3ms reads, ~10ms writes.

### roster — "who else is running?"

```bash
sqlite3 ~/.claude/channels/cc/sessions.db \
  "SELECT substr(id,1,8) AS sid, cwd, branch, datetime(last_seen_at_ms/1000,'unixepoch','localtime') AS last_seen
   FROM sessions WHERE ended_at_ms IS NULL
   ORDER BY last_seen_at_ms DESC"
```

### send — DM a peer

The recipient's cc-server FSWatcher dispatches the channel push notification
on ANY new `.msg` file landing in `inbox/<their-sid>/`. Direct write works
just like MCP send — same dispatch path on the recipient side.

```bash
# resolve target short_id → full session_id
TARGET_SID=$(sqlite3 ~/.claude/channels/cc/sessions.db \
  "SELECT id FROM sessions WHERE substr(id,1,8)='abcd1234' AND ended_at_ms IS NULL LIMIT 1")

# build .msg file via the helper (handles escaping + atomic write)
bash ${CLAUDE_PLUGIN_ROOT}/bin/cc-quick send "$TARGET_SID" "your message here" "optional subject"
```

If the helper isn't on disk yet (older install), use this canonical format:
```
From: <my_short_id> @ <cwd_basename>
From-Sid: <my_full_sid>
Urgency: normal
Timestamp: <ms_epoch>
Subject: <subject if any>
---
<body>
```
Filename: `<timestamp_ms>-<my_full_sid>-<msg_id>.msg`. Atomic write
(`<file>.tmp` then `mv`). Drop in `~/.claude/channels/cc/inbox/<target>/`.

### announce — broadcast status to all peers

```bash
sqlite3 ~/.claude/channels/cc/sessions.db <<SQL
INSERT INTO announcements (id, session_id, summary, detail, created_at_ms)
VALUES ('$(uuidgen | tr -d - | head -c 16)', '$CLAUDE_CODE_SESSION_ID',
        'refactoring auth.ts', NULL, $(date +%s%N | head -c 13));
SQL
```

Or use the helper: `bash ${CLAUDE_PLUGIN_ROOT}/bin/cc-quick announce "summary text"`.

### check — pull the awareness digest

For just "what's new since last check," sqlite is fine:
```bash
sqlite3 ~/.claude/channels/cc/sessions.db \
  "SELECT a.summary, a.detail, datetime(a.created_at_ms/1000,'unixepoch','localtime'),
          substr(a.session_id,1,8)
   FROM announcements a
   JOIN sessions s ON s.id=a.session_id
   WHERE s.ended_at_ms IS NULL
     AND a.session_id != '$CLAUDE_CODE_SESSION_ID'
     AND a.created_at_ms > (strftime('%s','now')*1000 - 30*60*1000)
   ORDER BY a.created_at_ms DESC LIMIT 10"
```

For the rich `digest_delta` + `subscription_matches` shape with proper
`last_checked_at_ms` advancement, prefer the MCP tool when it's reachable.

## The MCP path (when registered)

If `mcp__cc__cc` is in your tool list, prefer it for:
- `subscribe` / `unsubscribe` (typed args, validation)
- `check` (rich response shape with delta + subscription matches)
- any send where you want the structured `delivered_to` confirmation

```
cc({ action: "sessions" })
cc({ action: "send", to: "abcd1234", message: "30d vs 90d?", urgency: "question", subject: "tokens" })
cc({ action: "announce", summary: "refactoring auth.ts" })
cc({ action: "check", since_s: 3600 })
cc({ action: "subscribe", files: "src/auth/**", urgency_min: "question" })
```

The MCP tool registers at session start. The session that just ran
`/plugin install cc@claude-code-tips` won't have it until that terminal
restarts (Claude Code doesn't re-poll `tools/list` mid-session). New
sessions opened after the install pick it up immediately.

**Don't wait on it.** If MCP isn't reachable, use the fast path above —
same state, same dispatch, lower latency.

## Pick the action

| Intent | Action | Fast path? |
|---|---|---|
| "who else is running?" | `sessions` (read sqlite) | ✓ |
| "tell <peer> X" | `send` (write .msg file) | ✓ |
| "let peers know X" | `announce` (insert sqlite) | ✓ |
| "what's new" | `check` (sqlite query) | ✓ for plain; MCP for rich delta |
| "watch src/auth/**" | `subscribe` | MCP only (typed args) |
| "stop watching id=X" | `unsubscribe` | MCP only |

## Targeting peers (`send`)

The `to` field accepts:
- **short id** (8 hex chars from roster) — preferred
- **full session id** — UUID4
- **cwd basename** — convenient but ambiguous across worktrees

For urgency, use `'question'` only when you actually need a reply; default
`'normal'`. `'urgent'` is for blocking coordination ("about to push to your
branch").

## Awareness loop

- **The recipient's cc-server FSWatcher pushes channel notifications** the
  moment a `.msg` file lands. Senders don't need MCP for this to work.
- **File-overlap alerts** in the digest are advisory. Send a message before
  continuing edits on a flagged file.
- **`digest_delta` rides every cc call** (v3.3+). When using the MCP path,
  responses include a `digest_delta` block with new announcements + edits +
  peer joins/leaves since this session's last cc call. The fast path's
  sqlite query covers the same data without the delta-cursor advance.

## Why two paths?

- The fast path **always works**, including in the install-trigger session.
- The MCP path adds typed validation (zod), an exfil guard (rejects paths
  resolving under cc state dir), and the `digest_delta` cursor.
- Same sqlite + filesystem state behind both. Choose by latency need.
