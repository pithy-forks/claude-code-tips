<!-- tested with: claude code v2.1.118 -->

# lore

your accumulated claude code lore as a deterministic knowledge graph. every session, file, project, tool, and resume relationship becomes a node or edge that builds itself from your transcripts. all data stays local at `~/.claude/lore/lore.db`.

## install

```bash
/plugin marketplace add anipotts/claude-code-tips
/plugin install lore@cc
```

## usage

```
/lore                       today's sessions, cost, top tools (dashboard)
/lore search "websocket"    full-text search across all conversations
/lore hotspots              files you keep editing across sessions
/lore loops                 repeated patterns across sessions
/lore:help                  full intent menu
```

graph + remember + export commands ship in v2.0.x as the knowledge-graph layer comes online (see ROADMAP).

## how it works

a single python hook (`hooks/hook.py`) dispatches all events:

| event | what it does |
|---|---|
| SessionEnd | ingests the session transcript into sqlite |
| SessionStart | recalls relevant past sessions for the current project |
| PreCompact | flags cost anomalies before context compression |
| PostToolUseFailure | logs error patterns for `/lore` health intent |
| SubagentStop | tracks subagent usage |

data lives at `~/.claude/lore/lore.db`. legacy users on the v1.x `mine` plugin: `~/.claude/mine.db` is migrated automatically on first run, kept in place as a backup until you remove it manually. nothing leaves your machine.

## structure

- `.claude-plugin/plugin.json` - plugin manifest
- `hooks/hook.py` - unified hook dispatcher
- `hooks/hooks.json` - hook event registrations
- `scripts/mine.py` - bulk session parser (backfill, incremental, export). filename retained for v2.x source compatibility; will be renamed once the bun port lands
- `scripts/schema.sql` - database schema
- `commands/lore.md` - `/lore` slash command (routes to skills/query)
- `skills/query/SKILL.md` - intent routing
- `skills/help/SKILL.md` - `/lore:help`
- `tests/` - pytest suite

## upgrading from mine 1.x

the `mine` plugin was renamed to `lore` in v2.0 and repositioned around its knowledge-graph dimension. the slash command is now `/lore` (not `/mine`). the database moved from `~/.claude/mine.db` to `~/.claude/lore/lore.db`; the migration is automatic on first launch and your old file is left in place as a backup. no data loss, no manual steps.
