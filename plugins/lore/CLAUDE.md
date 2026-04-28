<!-- tested with: claude code v2.1.122 -->

# lore

claude code plugin that turns every session into a deterministic knowledge graph.

## structure

- `.claude-plugin/plugin.json` - plugin manifest
- `hooks/hook.py` - unified hook dispatcher (all events, one file)
- `hooks/hooks.json` - hook event registrations
- `scripts/mine.py` - bulk session parser (backfill, incremental, export). canonical filename retained for source-import compatibility through v2.x; will be renamed `lore.py` once the bun port lands
- `scripts/notes.py` - CRUD for the user-controlled `notes` table (schema v3); backs `/lore:remember`
- `scripts/anthropic_canonical.py` - parallel ingest of Anthropic-canonical session sources so /usage and /lore agree
- `scripts/_common.py` - shared helpers (CLAUDE_DIR, LORE_DIR, now_iso, prefer, safe_load_json, migrate_legacy_files, log_stderr)
- `scripts/schema.sql` - database schema (v3: adds `notes` table + `file_cooccurrences` view)
- `commands/lore.md` - `/lore` slash command (entry point, routes to skills/query)
- `commands/remember.md` / `commands/graph.md` / `commands/export.md` - knowledge-graph commands
- `skills/query/SKILL.md` - intent routing (dashboard, search, health, costs, patterns)
- `skills/help/SKILL.md` - `/lore:help`
- `skills/remember/SKILL.md` - `/lore:remember` (capture decisions/lessons/reminders into the notes table)
- `skills/graph/SKILL.md` - `/lore:graph` (file cooccurrence, project files, sibling sessions)
- `skills/export/SKILL.md` - `/lore:export` (json/csv/markdown snapshots)
- `tests/` - pytest suite (test_mine.py, test_hooks.py, test_notes.py)

## conventions

- all hooks handled by hook.py - no bash, no jq
- stdout = visible to claude (warnings, search recall)
- stderr = debug logging only
- database at `~/.claude/lore/lore.db` (v2.0+); legacy `~/.claude/mine.db` is migrated automatically on first run, kept as backup
- ignore file at `~/.claude/lore/.loreignore` (legacy `~/.claude/.mineignore` honored as fallback)
- all SQL uses parameterized queries
- no cross-plugin paths: lore is standalone, never reaches into `~/.claude/cc/` or `~/.claude/time/`

## knowledge graph layers

The graph has two storage modes plus one deferred:

1. **derived from JSONL** -- sessions, messages, tool_calls, errors. Built by `mine.py`, fully recomputable.
2. **user-tagged** -- the `notes` table, populated only by `/lore:remember`. Schema v3.
3. **computed views** -- `file_cooccurrences` (pairs of files touched in the same session). Recomputed live, no pipeline.
4. **deferred** -- `session_resumes` (no clean marker in JSONL), `error_resolutions` (too heuristic without tagged ground truth). Reconsider once `/lore:remember` data accumulates.
