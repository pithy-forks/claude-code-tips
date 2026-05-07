---
name: sessions
description: |
  See active Claude Code sessions on this machine and coordinate across them
  via direct messages, status announcements, and file-overlap awareness.
  Triggers when the user asks "who else is running?", "any other claude open?",
  "what other sessions are active?", "tell <name> to ...", "ping <peer>",
  "let peers know I'm doing X", "broadcast <status>", "check the cc digest",
  or any cross-session / multi-agent coordination on this machine.
---
<!-- tested with: claude code v2.1.132 -->

# cc — session mesh

Use the **cc MCP tool** with one of four actions. The tool description in
your context already documents arg shapes; this skill covers *when* to pick
which action.

## After a fresh install

The MCP tool is registered when a Claude Code session starts. **The session
that just ran `/plugin install cc@claude-code-tips` cannot itself call the
tool until that terminal restarts** — Claude Code doesn't re-poll
`tools/list` mid-session. New sessions opened after the install pick up the
tool immediately.

If `mcp__cc__cc` isn't in your tool list:

- Tell the user to open a new terminal and run `claude` there. That session
  has the tool.
- For the roster verb only, you can fall back to a direct sqlite read:
  `sqlite3 ~/.claude/channels/cc/sessions.db "SELECT id, cwd, last_seen_at_ms FROM sessions WHERE ended_at_ms IS NULL ORDER BY last_seen_at_ms DESC"`.
  This is read-only and only useful for "who's running"; for `send` /
  `announce` / `check` you need the MCP tool.
- The cc plugin's SessionStart hook registers every session in the cc table
  on session start, so peer visibility works regardless of whether the MCP
  tool is reachable in *this* session.

## Pick the action

| Intent | Action |
|---|---|
| "who else is running?", "any other claude open?" | `sessions` |
| "tell <peer> X", "ask <peer> Y", "ping merizo" | `send` |
| "let peers know I'm refactoring auth", "broadcast: tests are red" | `announce` |
| "what's happening on this machine right now?", explicit poll | `check` |

## Targeting peers (`send`)

The `to` field accepts:

- **short id** (8 hex chars from `cc(action='sessions')`) — preferred when
  multiple sessions share a cwd basename
- **full session id** — UUID4
- **cwd basename** — convenient but ambiguous across worktrees

Use `urgency='question'` only when you actually need a reply; otherwise
`'normal'` (default) is right. `'urgent'` is reserved for blocking
coordination (e.g. "I'm about to push to the same branch you're rebasing").

## Awareness loop

- **Channel push notifications** cover realtime DM arrival; you don't need
  to call `check` on every turn just to stay current.
- **File-overlap alerts** in the digest are advisory, not blocking. Send a
  message before continuing edits on a flagged file — that's the protocol.
- **Announcements** are fire-and-forget broadcasts; peers see them in their
  next digest. No reply expected.

## Examples

```
# list peers
cc({ action: "sessions" })

# DM a peer (asking a question)
cc({
  action: "send",
  to: "abcd1234",
  message: "30d vs 90d refresh on auth tokens?",
  urgency: "question",
  subject: "token ttl",
})

# broadcast status
cc({
  action: "announce",
  summary: "refactoring auth.ts -- branch: feat/oauth",
})

# explicit digest poll
cc({ action: "check", since_s: 3600 })
```

## What's NOT here

- No topic verbs (`subscribe`, `unsubscribe`) — dropped in v3 pending
  validation against real usage. Use `send` and `announce` for now.
- No explicit `cleanup` — runs automatically on session shutdown.
