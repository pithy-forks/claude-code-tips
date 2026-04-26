#!/usr/bin/env python3
# tested with: claude code v2.1.118
"""anthropic_canonical.py -- ingest Anthropic's pre-computed stats sources.

Anthropic's `/usage` reads from two persistent local files that survive the
30-day JSONL retention sweep:

  ~/.claude/stats-cache.json
      pre-computed daily aggregates: dailyActivity, modelUsage, hourCounts,
      totalSessions, totalMessages, firstSessionDate, lastComputedDate, etc.

  ~/.claude/projects/<project>/sessions-index.json
      per-project session metadata: sessionId, firstPrompt, messageCount,
      created, modified, gitBranch, projectPath, isSidechain.

This module mirrors both into the lore database under tables prefixed with
`anthropic_*`. The lore knowledge graph keeps full transcript-derived data
for sessions whose JSONLs still exist; the anthropic_* tables provide
canonical totals + per-session metadata for sessions whose JSONLs were
already cleaned up by Claude Code's retention sweep.

Result: lore's totals exactly match what Claude Code's /usage shows.
Discrepancies are bugs and printed by verify_alignment().
"""

from __future__ import annotations

import json
import pathlib
import sqlite3
import sys
from datetime import datetime, timezone

CLAUDE_DIR = pathlib.Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"
STATS_CACHE_PATH = CLAUDE_DIR / "stats-cache.json"


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS anthropic_stats (
    last_computed_date TEXT PRIMARY KEY,
    total_sessions INTEGER,
    total_messages INTEGER,
    total_tool_calls INTEGER,
    first_session_date TEXT,
    active_days_count INTEGER,
    longest_session_id TEXT,
    longest_session_duration_ms INTEGER,
    longest_session_message_count INTEGER,
    peak_hour INTEGER,
    favorite_model TEXT,
    raw_json TEXT,
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anthropic_daily_activity (
    date TEXT PRIMARY KEY,
    message_count INTEGER NOT NULL DEFAULT 0,
    session_count INTEGER NOT NULL DEFAULT 0,
    tool_call_count INTEGER NOT NULL DEFAULT 0,
    last_computed_date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anth_daily_date ON anthropic_daily_activity(date);

CREATE TABLE IF NOT EXISTS anthropic_model_usage (
    model TEXT PRIMARY KEY,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_input_tokens INTEGER DEFAULT 0,
    cache_creation_input_tokens INTEGER DEFAULT 0,
    web_search_requests INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    context_window INTEGER DEFAULT 0,
    max_output_tokens INTEGER DEFAULT 0,
    last_computed_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anthropic_hour_counts (
    hour INTEGER PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    last_computed_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anthropic_session_index (
    session_id TEXT PRIMARY KEY,
    full_path TEXT,
    file_mtime_ms INTEGER,
    first_prompt TEXT,
    message_count INTEGER,
    created TEXT,
    modified TEXT,
    git_branch TEXT,
    project_path TEXT,
    is_sidechain INTEGER NOT NULL DEFAULT 0,
    source_index_path TEXT,
    ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anth_sidx_proj ON anthropic_session_index(project_path);
CREATE INDEX IF NOT EXISTS idx_anth_sidx_modified ON anthropic_session_index(modified);
"""


def apply_schema(conn: sqlite3.Connection) -> None:
    """Idempotent schema bootstrap. Safe to call repeatedly."""
    conn.executescript(SCHEMA_SQL)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ingest_stats_cache(conn: sqlite3.Connection) -> dict:
    """Parse ~/.claude/stats-cache.json and upsert into anthropic_stats +
    anthropic_daily_activity + anthropic_model_usage + anthropic_hour_counts.
    Returns the totals dict for callers that want to print or log."""
    if not STATS_CACHE_PATH.exists():
        return {}
    try:
        data = json.loads(STATS_CACHE_PATH.read_text())
    except (json.JSONDecodeError, OSError) as e:
        print(f"[lore] failed to parse stats-cache.json: {e}", file=sys.stderr)
        return {}

    last_computed = data.get("lastComputedDate", "")
    daily = data.get("dailyActivity") or []
    model_usage = data.get("modelUsage") or {}
    hour_counts = data.get("hourCounts") or {}

    total_tool_calls = sum((d.get("toolCallCount") or 0) for d in daily)
    longest = data.get("longestSession") or {}
    peak_hour = None
    if hour_counts:
        try:
            peak_hour = int(max(hour_counts.items(), key=lambda kv: kv[1])[0])
        except (ValueError, TypeError):
            peak_hour = None
    favorite_model = None
    if model_usage:
        try:
            favorite_model = max(
                model_usage.items(),
                key=lambda kv: (kv[1].get("inputTokens", 0) + kv[1].get("outputTokens", 0)),
            )[0]
        except (ValueError, TypeError):
            favorite_model = None

    conn.execute(
        """
        INSERT OR REPLACE INTO anthropic_stats (
            last_computed_date, total_sessions, total_messages, total_tool_calls,
            first_session_date, active_days_count,
            longest_session_id, longest_session_duration_ms, longest_session_message_count,
            peak_hour, favorite_model, raw_json, ingested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            last_computed,
            data.get("totalSessions"),
            data.get("totalMessages"),
            total_tool_calls,
            data.get("firstSessionDate"),
            len(daily),
            longest.get("sessionId"),
            longest.get("duration"),
            longest.get("messageCount"),
            peak_hour,
            favorite_model,
            json.dumps(data),
            now_iso(),
        ),
    )

    # daily activity
    for d in daily:
        conn.execute(
            """
            INSERT OR REPLACE INTO anthropic_daily_activity
            (date, message_count, session_count, tool_call_count, last_computed_date)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                d.get("date"),
                d.get("messageCount") or 0,
                d.get("sessionCount") or 0,
                d.get("toolCallCount") or 0,
                last_computed,
            ),
        )

    # model usage
    for model, m in model_usage.items():
        conn.execute(
            """
            INSERT OR REPLACE INTO anthropic_model_usage (
                model, input_tokens, output_tokens, cache_read_input_tokens,
                cache_creation_input_tokens, web_search_requests, cost_usd,
                context_window, max_output_tokens, last_computed_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                model,
                m.get("inputTokens") or 0,
                m.get("outputTokens") or 0,
                m.get("cacheReadInputTokens") or 0,
                m.get("cacheCreationInputTokens") or 0,
                m.get("webSearchRequests") or 0,
                m.get("costUSD") or 0,
                m.get("contextWindow") or 0,
                m.get("maxOutputTokens") or 0,
                last_computed,
            ),
        )

    # hour counts
    for hour_str, count in hour_counts.items():
        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO anthropic_hour_counts (hour, count, last_computed_date)
                VALUES (?, ?, ?)
                """,
                (int(hour_str), count, last_computed),
            )
        except (ValueError, TypeError):
            continue

    conn.commit()
    return {
        "total_sessions": data.get("totalSessions"),
        "total_messages": data.get("totalMessages"),
        "total_tool_calls": total_tool_calls,
        "active_days": len(daily),
        "last_computed_date": last_computed,
        "favorite_model": favorite_model,
        "peak_hour": peak_hour,
    }


def ingest_session_indexes(conn: sqlite3.Connection) -> dict:
    """Walk every ~/.claude/projects/<proj>/sessions-index.json and upsert
    into anthropic_session_index. Returns counts dict."""
    if not PROJECTS_DIR.exists():
        return {"files_read": 0, "entries_upserted": 0}

    files_read = 0
    entries_upserted = 0
    ingested_at = now_iso()

    for index_path in PROJECTS_DIR.glob("*/sessions-index.json"):
        try:
            data = json.loads(index_path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        files_read += 1
        for entry in data.get("entries") or []:
            session_id = entry.get("sessionId")
            if not session_id:
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO anthropic_session_index (
                    session_id, full_path, file_mtime_ms, first_prompt,
                    message_count, created, modified, git_branch, project_path,
                    is_sidechain, source_index_path, ingested_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    entry.get("fullPath"),
                    entry.get("fileMtime"),
                    entry.get("firstPrompt"),
                    entry.get("messageCount"),
                    entry.get("created"),
                    entry.get("modified"),
                    entry.get("gitBranch"),
                    entry.get("projectPath") or data.get("originalPath"),
                    1 if entry.get("isSidechain") else 0,
                    str(index_path),
                    ingested_at,
                ),
            )
            entries_upserted += 1
    conn.commit()
    return {"files_read": files_read, "entries_upserted": entries_upserted}


def verify_alignment(conn: sqlite3.Connection) -> dict:
    """Compare lore.db's transcript-derived counts against Anthropic's canonical
    counts. Returns a dict of {metric: {anthropic, lore, delta, aligned}}.
    A bug surfaces here as aligned=False with a non-zero delta."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT total_sessions, total_messages, total_tool_calls
        FROM anthropic_stats
        ORDER BY last_computed_date DESC
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        return {"error": "no anthropic_stats row; run ingest_stats_cache first"}
    anth_sessions, anth_messages, anth_tools = row

    cur.execute("SELECT COUNT(*) FROM sessions WHERE is_subagent = 0")
    lore_sessions = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM messages")
    lore_messages = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tool_calls")
    lore_tools = cur.fetchone()[0]

    def diff(a, l):
        if a is None or l is None:
            return {"anthropic": a, "lore": l, "delta": None, "aligned": False}
        d = l - a
        return {"anthropic": a, "lore": l, "delta": d, "aligned": d == 0}

    return {
        "sessions": diff(anth_sessions, lore_sessions),
        "messages": diff(anth_messages, lore_messages),
        "tool_calls": diff(anth_tools, lore_tools),
    }


def refresh(db_path: pathlib.Path) -> dict:
    """End-to-end: open db, apply schema, ingest both sources, verify.
    Idempotent. Safe to call from a SessionStart hook on every launch."""
    conn = sqlite3.connect(str(db_path), timeout=5)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        apply_schema(conn)
        stats = ingest_stats_cache(conn)
        idx = ingest_session_indexes(conn)
        alignment = verify_alignment(conn)
        return {
            "stats": stats,
            "session_index": idx,
            "alignment": alignment,
        }
    finally:
        conn.close()


def main() -> int:
    """CLI entry: refresh anthropic-canonical tables in lore.db and print summary."""
    import argparse
    parser = argparse.ArgumentParser(description="Refresh Anthropic canonical stats in lore.db")
    parser.add_argument(
        "--db",
        default=str(CLAUDE_DIR / "lore" / "lore.db"),
        help="Path to lore.db (default: ~/.claude/lore/lore.db)",
    )
    parser.add_argument("--quiet", action="store_true", help="Suppress non-error output")
    args = parser.parse_args()

    db_path = pathlib.Path(args.db)
    if not db_path.exists():
        print(f"[lore] {db_path} does not exist; nothing to refresh", file=sys.stderr)
        return 1
    result = refresh(db_path)
    if args.quiet:
        return 0

    stats = result.get("stats", {}) or {}
    idx = result.get("session_index", {}) or {}
    align = result.get("alignment", {}) or {}

    print("[lore] anthropic canonical refresh:")
    print(f"  stats-cache.json: lastComputedDate={stats.get('last_computed_date')}, "
          f"totalSessions={stats.get('total_sessions')}, "
          f"totalMessages={stats.get('total_messages')}, "
          f"totalToolCalls={stats.get('total_tool_calls')}")
    print(f"  sessions-index.json: {idx.get('files_read')} files read, "
          f"{idx.get('entries_upserted')} session-index entries upserted")
    print("[lore] alignment with /usage:")
    for k, v in align.items():
        if isinstance(v, dict):
            mark = "OK" if v.get("aligned") else "DRIFT"
            print(f"  {k}: anthropic={v.get('anthropic')} lore={v.get('lore')} delta={v.get('delta')} [{mark}]")
        else:
            print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
