---
name: graph
description: explore relationships in the lore knowledge graph - cooccurring files, project sessions, sibling sessions, tagged notes
tools: Bash, Read, AskUserQuestion
---
<!-- tested with: claude code v2.1.118 -->

When the user runs `/lore:graph`, surface relationships derived from their session history. Unlike `/lore` (which is a dashboard / freeform query) this skill is *graph-shaped*: nodes are sessions, files, projects, tools, and notes; edges are cooccurrence, parent-child, and tags.

## locate the database

`````bash
DB="$HOME/.claude/lore/lore.db"
[ -f "$DB" ] || DB="$HOME/.claude/mine.db"
if [ ! -f "$DB" ]; then echo "no lore.db -- run /lore once to seed it"; exit 0; fi
`````

If the database doesn't exist, tell the user to run `/lore` once (which auto-backfills) and stop.

## intents

| user phrasing | edge type | query |
|---|---|---|
| "what files appear with X", "what cooccurs with X", "neighbors of X" | file cooccurrence | see `cooccurrence` below |
| "show project graph for X", "files in project X" | project → files | see `project_files` below |
| "sibling sessions to X", "what came before/after X" | session sequencing | see `siblings` below |
| "notes about X", "tagged X" | notes | call `notes.py search "X"` or `notes.py list --tag X` |
| "graph for this file" (no args, in a file) | cooccurrence on cwd file | resolve the active file path, then `cooccurrence` |
| "summary", no args | global graph stats | see `summary` below |

## queries

### cooccurrence

Resolve the user's "file" argument loosely -- they'll often give a short name (`hook.py`) when the DB has absolute paths. Use a LIKE match.

`````bash
TARGET="$1"  # e.g. "hook.py" or "/abs/path/to/file"
sqlite3 -header -column "$DB" <<SQL
SELECT
  CASE WHEN file_a LIKE '%' || '$TARGET' || '%' THEN file_b ELSE file_a END AS neighbor,
  session_count,
  last_seen
FROM file_cooccurrences
WHERE file_a LIKE '%' || '$TARGET' || '%' OR file_b LIKE '%' || '$TARGET' || '%'
ORDER BY session_count DESC
LIMIT 20;
SQL
`````

If the LIKE returns nothing, try a wider match (basename only) before saying "no neighbors".

### project_files

`````bash
PROJECT="$1"
sqlite3 -header -column "$DB" <<SQL
SELECT tc.input_summary AS file, COUNT(DISTINCT tc.session_id) AS sessions,
       MAX(tc.timestamp) AS last_touched
FROM tool_calls tc
JOIN sessions s ON tc.session_id = s.id
WHERE s.project_name = '$PROJECT'
  AND tc.tool_name IN ('Edit','Read','Write','MultiEdit')
  AND tc.input_summary IS NOT NULL
GROUP BY tc.input_summary
ORDER BY sessions DESC
LIMIT 25;
SQL
`````

### siblings

Sibling sessions = sessions in the same project, ordered by start_time, with the target session in the middle. Useful for "what was I doing right before/after this".

`````bash
SESSION_ID="$1"
sqlite3 -header -column "$DB" <<SQL
WITH target AS (SELECT project_name, start_time FROM sessions WHERE id = '$SESSION_ID')
SELECT s.id, s.start_time, s.first_user_prompt
FROM sessions s, target t
WHERE s.project_name = t.project_name
  AND s.is_subagent = 0
ORDER BY ABS(strftime('%s', s.start_time) - strftime('%s', t.start_time))
LIMIT 5;
SQL
`````

### summary

`````bash
sqlite3 -header -column "$DB" <<SQL
SELECT
  (SELECT COUNT(*) FROM sessions WHERE is_subagent = 0) AS sessions,
  (SELECT COUNT(DISTINCT project_name) FROM sessions WHERE project_name IS NOT NULL) AS projects,
  (SELECT COUNT(DISTINCT input_summary) FROM tool_calls WHERE tool_name IN ('Edit','Read','Write','MultiEdit') AND input_summary IS NOT NULL) AS distinct_files,
  (SELECT COUNT(*) FROM file_cooccurrences) AS file_pairs,
  (SELECT COUNT(*) FROM notes) AS notes;
SQL
`````

## scoping

Default to global. If the user is inside a project that exists in `sessions.project_name`, mention it ("scoped to <project>; say 'global' to widen") and add a `WHERE project_name = ...` filter where it makes sense.

## output

`sqlite3 -header -column` already produces clean tables -- pass them through. If a result is large (>30 rows), summarize counts at the bottom rather than dumping everything. If the query returns zero rows, suggest an alternative ("no neighbors for `hook.py` in your history; try `/lore:graph project lore` instead").
