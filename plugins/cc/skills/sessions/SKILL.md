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
<!-- tested with: claude code v2.1.122 -->

# cc — session mesh

Use the **cc MCP tool** with one of four actions. The tool description in
your context already documents arg shapes; this skill covers *when* to pick
which action.

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
