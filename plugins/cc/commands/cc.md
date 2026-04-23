---
description: session mesh for claude code (email-cc semantics). see live sessions, send messages, broadcast status, subscribe to topics
model: haiku
---

Use the `cc` MCP tool. One tool, verb dispatch via the `action` argument.

## verbs and when to use them

- **`action: "sessions"`** - list live sessions on this machine
  Example: "who else is running?" -> `cc sessions`

- **`action: "send"`** - direct message a session, or broadcast to a topic
  Fields: `to` (session name) OR `topic` (e.g. `#auth`), `message`, optional `subject`, `urgency` (`low` / `normal` / `urgent` / `question`)
  Example: "tell merizo to pause" -> `cc send to=merizo message="pause"`
  Example: "ask #auth if 30d tokens ok" -> `cc send topic=#auth message="30d tokens ok?" urgency=question subject="token ttl"`

- **`action: "announce"`** - voluntary status broadcast (fyi-to-team)
  Fields: `summary`, optional `detail`, optional `topics`
  Example: "let peers know I'm refactoring auth" -> `cc announce summary="refactoring auth.ts" topics=["#auth"]`

- **`action: "check"`** - awareness digest (structured + rendered string)
  Optional `since_s` forces lookback window (e.g. 3600 for last hour)
  Example: "what's happening on this machine?" -> `cc check since_s=3600`

- **`action: "subscribe"`** / `"unsubscribe"` - topic subscriptions
  Example: "subscribe to #deploy" -> `cc subscribe topic=#deploy`

- **`action: "cleanup"`** - called only by the `SessionEnd` hook; no manual use.

- **`action: "ask"` / `"answer"`** - scaffolded for 2.1.0; not wired yet. Use `send` with `urgency: "question"` for now.

## hints

- Every user turn, the `UserPromptSubmit` hook calls `cc check` and injects the digest into your context before you respond. Watch for `cc digest (...)` context blocks; they tell you what other sessions are doing and warn about file overlaps.
- Prefer topic subscriptions over direct messages for team-style awareness (e.g. `#auth`, `#deploy`). Direct messages are for "please respond"; topics are "fyi."
- When a digest flags a file overlap, send a `cc send` to the other session before continuing edits on that file.
