#!/usr/bin/env python3
# tested with: claude code v2.1.118
"""notes.py -- /lore:remember backing store.

User-tagged decisions/lessons/reminders persisted to the same lore.db
that mine.py populates. CLI surface is intentionally small so the
remember skill can drive it from a few Bash invocations.

Usage:
    notes.py add "title" [--body BODY] [--type TYPE] [--tags a,b,c]
                         [--project NAME] [--session ID] [--file PATH]
    notes.py list [--project NAME] [--type TYPE] [--tag TAG]
                  [--limit N] [--since YYYY-MM-DD] [--json]
    notes.py get ID [--json]
    notes.py search "query" [--limit N] [--json]
    notes.py delete ID [--yes]
    notes.py update ID [--title T] [--body B] [--type T] [--tags T]

All commands exit 0 on success, 1 on user error, 2 on lookup miss.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sqlite3
import sys
from typing import Any

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _common import LORE_DIR, now_iso  # noqa: E402

DB_PATH = LORE_DIR / "lore.db"
SCHEMA_PATH = pathlib.Path(__file__).resolve().parent / "schema.sql"

VALID_TYPES = {"note", "decision", "lesson", "reminder", "tag", "todo"}


def db_connect() -> sqlite3.Connection:
    """Open lore.db and ensure the notes table exists. Schema is idempotent
    so applying it on every connect is safe and self-healing for fresh DBs."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA_PATH.read_text())
    return conn


def cmd_add(args: argparse.Namespace) -> int:
    if args.type and args.type not in VALID_TYPES:
        print(f"error: type must be one of {sorted(VALID_TYPES)}", file=sys.stderr)
        return 1
    conn = db_connect()
    now = now_iso()
    cur = conn.execute(
        """INSERT INTO notes (project_name, session_id, file_path, note_type,
                              title, body, tags, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            args.project,
            args.session,
            args.file,
            args.type or "note",
            args.title,
            args.body,
            args.tags,
            now,
            now,
        ),
    )
    conn.commit()
    note_id = cur.lastrowid
    if args.json:
        print(json.dumps({"id": note_id, "created_at": now}))
    else:
        print(f"saved note #{note_id}")
    return 0


def _format_note(row: sqlite3.Row, *, full: bool) -> str:
    parts = [f"#{row['id']} [{row['note_type']}] {row['title']}"]
    meta = []
    if row["project_name"]:
        meta.append(f"project={row['project_name']}")
    if row["session_id"]:
        meta.append(f"session={row['session_id'][:8]}")
    if row["file_path"]:
        meta.append(f"file={row['file_path']}")
    if row["tags"]:
        meta.append(f"tags={row['tags']}")
    if meta:
        parts.append("  " + " · ".join(meta))
    parts.append(f"  created={row['created_at']}")
    if full and row["body"]:
        parts.append("")
        parts.append(row["body"])
    return "\n".join(parts)


def _emit(rows: list[sqlite3.Row], *, as_json: bool, full: bool = False) -> None:
    if as_json:
        print(json.dumps([dict(r) for r in rows], indent=2, default=str))
        return
    if not rows:
        print("(no notes)")
        return
    for row in rows:
        print(_format_note(row, full=full))
        print()


def cmd_list(args: argparse.Namespace) -> int:
    where = []
    params: list[Any] = []
    if args.project:
        where.append("project_name = ?")
        params.append(args.project)
    if args.type:
        where.append("note_type = ?")
        params.append(args.type)
    if args.tag:
        where.append("(',' || tags || ',') LIKE ?")
        params.append(f"%,{args.tag},%")
    if args.since:
        where.append("created_at >= ?")
        params.append(args.since)
    sql = "SELECT * FROM notes"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(args.limit)
    conn = db_connect()
    rows = conn.execute(sql, params).fetchall()
    _emit(rows, as_json=args.json)
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    conn = db_connect()
    row = conn.execute("SELECT * FROM notes WHERE id = ?", (args.id,)).fetchone()
    if not row:
        print(f"note #{args.id} not found", file=sys.stderr)
        return 2
    _emit([row], as_json=args.json, full=True)
    return 0


def cmd_search(args: argparse.Namespace) -> int:
    pattern = f"%{args.query}%"
    conn = db_connect()
    rows = conn.execute(
        """SELECT * FROM notes
           WHERE title LIKE ? OR body LIKE ? OR tags LIKE ?
           ORDER BY created_at DESC LIMIT ?""",
        (pattern, pattern, pattern, args.limit),
    ).fetchall()
    _emit(rows, as_json=args.json)
    return 0


def cmd_delete(args: argparse.Namespace) -> int:
    conn = db_connect()
    row = conn.execute("SELECT id, title FROM notes WHERE id = ?", (args.id,)).fetchone()
    if not row:
        print(f"note #{args.id} not found", file=sys.stderr)
        return 2
    if not args.yes:
        print(f"delete #{row['id']} '{row['title']}'? rerun with --yes", file=sys.stderr)
        return 1
    conn.execute("DELETE FROM notes WHERE id = ?", (args.id,))
    conn.commit()
    print(f"deleted note #{args.id}")
    return 0


def cmd_update(args: argparse.Namespace) -> int:
    fields = []
    params: list[Any] = []
    if args.title is not None:
        fields.append("title = ?")
        params.append(args.title)
    if args.body is not None:
        fields.append("body = ?")
        params.append(args.body)
    if args.type is not None:
        if args.type not in VALID_TYPES:
            print(f"error: type must be one of {sorted(VALID_TYPES)}", file=sys.stderr)
            return 1
        fields.append("note_type = ?")
        params.append(args.type)
    if args.tags is not None:
        fields.append("tags = ?")
        params.append(args.tags)
    if not fields:
        print("error: no fields to update", file=sys.stderr)
        return 1
    fields.append("updated_at = ?")
    params.append(now_iso())
    params.append(args.id)
    conn = db_connect()
    cur = conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    if cur.rowcount == 0:
        print(f"note #{args.id} not found", file=sys.stderr)
        return 2
    print(f"updated note #{args.id}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="lore notes CLI (/lore:remember backing store)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="create a new note")
    p_add.add_argument("title")
    p_add.add_argument("--body", default=None)
    p_add.add_argument("--type", default="note")
    p_add.add_argument("--tags", default=None, help="comma-separated")
    p_add.add_argument("--project", default=None)
    p_add.add_argument("--session", default=None)
    p_add.add_argument("--file", default=None)
    p_add.add_argument("--json", action="store_true")
    p_add.set_defaults(func=cmd_add)

    p_list = sub.add_parser("list", help="list recent notes")
    p_list.add_argument("--project", default=None)
    p_list.add_argument("--type", default=None)
    p_list.add_argument("--tag", default=None)
    p_list.add_argument("--since", default=None, help="ISO date or timestamp")
    p_list.add_argument("--limit", type=int, default=20)
    p_list.add_argument("--json", action="store_true")
    p_list.set_defaults(func=cmd_list)

    p_get = sub.add_parser("get", help="show one note in full")
    p_get.add_argument("id", type=int)
    p_get.add_argument("--json", action="store_true")
    p_get.set_defaults(func=cmd_get)

    p_search = sub.add_parser("search", help="search notes by substring")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=20)
    p_search.add_argument("--json", action="store_true")
    p_search.set_defaults(func=cmd_search)

    p_del = sub.add_parser("delete", help="delete a note")
    p_del.add_argument("id", type=int)
    p_del.add_argument("--yes", action="store_true", help="skip confirmation")
    p_del.set_defaults(func=cmd_delete)

    p_upd = sub.add_parser("update", help="update fields on an existing note")
    p_upd.add_argument("id", type=int)
    p_upd.add_argument("--title", default=None)
    p_upd.add_argument("--body", default=None)
    p_upd.add_argument("--type", default=None)
    p_upd.add_argument("--tags", default=None)
    p_upd.set_defaults(func=cmd_update)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
