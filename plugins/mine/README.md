<!-- tested with: claude code v2.1.94 -->

# mine

mines every claude code session into a local sqlite database. costs, search, error memory, pattern detection. all data stays local at `~/.claude/mine.db`.

## install

```bash
/plugin marketplace add anipotts/claude-code-tips
/plugin install mine@cc
```

## usage

```
/mine                     today's sessions, cost, top tools
/mine search "websocket"  full-text search across all conversations
/mine mistakes            error patterns claude keeps repeating
/mine hotspots            most-edited files across sessions
/mine loops               repeated patterns across sessions
```

## how it works

a single python hook (`hooks/hook.py`) dispatches all events:

| event | what it does |
|---|---|
| SessionEnd | ingests the session transcript into sqlite |
| SessionStart | recalls relevant past sessions for the current project |
| PreCompact | flags cost anomalies before context compression |
| PostToolUseFailure | logs error patterns for `/mine mistakes` |
| SubagentStop | tracks subagent usage |

data lives at `~/.claude/mine.db`. nothing leaves your machine.

## structure

- `.claude-plugin/plugin.json` - plugin manifest
- `hooks/hook.py` - unified hook dispatcher
- `hooks/hooks.json` - hook event registrations
- `scripts/mine.py` - bulk session parser (backfill, incremental, export)
- `scripts/schema.sql` - database schema
- `skills/` - `/mine` and `/mine:help` skills
- `tests/` - 125 tests
