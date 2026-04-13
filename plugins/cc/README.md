<!-- tested with: claude code v2.1.94 -->

# cc

cross-session messaging for claude code. see what other sessions are doing, send messages between them.

## install

```bash
/plugin marketplace add anipotts/claude-code-tips
/plugin install cc@cc
```

## usage

```
/cc                          show active sessions
/cc send merizo "pause"      message another session
```

messages arrive as `<channel source="cc" from="SESSION_NAME">` tags. sessions auto-register on start and clean up on exit.

## how it works

an MCP server (`server.ts`) uses `fs.watch()` for instant message delivery between sessions. each session gets an inbox directory. messages are delivered as files, watched in real-time, and cleaned up after reading.

## structure

- `.claude-plugin/plugin.json` — plugin manifest (MCP server)
- `server.ts` — MCP server (TypeScript, fs.watch)
- `hooks/cc-hook.mjs` — session lifecycle (register/cleanup)
- `commands/cc.md` — `/cc` slash command
