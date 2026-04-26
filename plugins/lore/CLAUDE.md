<!-- tested with: claude code v2.1.118 -->

# lore

claude code plugin that turns every session into a deterministic knowledge graph.

## structure

- `.claude-plugin/plugin.json` - plugin manifest
- `hooks/hook.py` - unified hook dispatcher (all events, one file)
- `hooks/hooks.json` - hook event registrations
- `scripts/mine.py` - bulk session parser (backfill, incremental, export). canonical filename retained for source-import compatibility through v2.x; will be renamed `lore.py` once the bun port lands
- `scripts/schema.sql` - database schema
- `commands/lore.md` - `/lore` slash command (entry point, routes to skills/query)
- `skills/query/SKILL.md` - intent routing (dashboard, search, health, costs, patterns)
- `skills/help/SKILL.md` - `/lore:help`
- `tests/` - pytest suite for the parser

## conventions

- all hooks handled by hook.py - no bash, no jq
- stdout = visible to claude (warnings, search recall)
- stderr = debug logging only
- database at `~/.claude/lore/lore.db` (v2.0+); legacy `~/.claude/mine.db` is migrated automatically on first run, kept as backup
- ignore file at `~/.claude/lore/.loreignore` (legacy `~/.claude/.mineignore` honored as fallback)
- all SQL uses parameterized queries
- no cross-plugin paths: lore is standalone, never reaches into `~/.claude/cc/` or `~/.claude/time/`
