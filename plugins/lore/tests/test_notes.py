"""Tests for notes.py -- /lore:remember backing store + the
file_cooccurrences view added in schema v3."""

from __future__ import annotations

import json
import pathlib
import sqlite3
import sys

import pytest

SCRIPTS_DIR = pathlib.Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import notes  # noqa: E402


@pytest.fixture
def tmp_db(tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch) -> pathlib.Path:
    """Point notes.DB_PATH at a temp file so we never touch the real lore.db."""
    db_path = tmp_path / "lore.db"
    monkeypatch.setattr(notes, "DB_PATH", db_path)
    monkeypatch.setattr(notes, "LORE_DIR", tmp_path)
    return db_path


def _ns(**kwargs):
    """Tiny argparse.Namespace stand-in so we can call cmd_* directly."""
    import argparse

    base = {
        "title": None,
        "body": None,
        "type": None,
        "tags": None,
        "project": None,
        "session": None,
        "file": None,
        "json": False,
        "id": None,
        "yes": False,
        "limit": 20,
        "since": None,
        "tag": None,
        "query": None,
    }
    base.update(kwargs)
    return argparse.Namespace(**base)


# ===========================================================================
# notes table CRUD
# ===========================================================================


class TestNotesAdd:
    def test_add_minimal_note(self, tmp_db, capsys):
        rc = notes.cmd_add(_ns(title="hello"))
        assert rc == 0
        assert "saved note #1" in capsys.readouterr().out

    def test_add_with_all_fields(self, tmp_db, capsys):
        rc = notes.cmd_add(
            _ns(
                title="full note",
                body="multi\nline\nbody",
                type="decision",
                tags="a,b,c",
                project="proj",
                session="sess123",
                file="/abs/path",
            )
        )
        assert rc == 0
        with sqlite3.connect(str(tmp_db)) as conn:
            conn.row_factory = sqlite3.Row
            row = dict(conn.execute("SELECT * FROM notes").fetchone())
        assert row["title"] == "full note"
        assert row["body"] == "multi\nline\nbody"
        assert row["note_type"] == "decision"
        assert row["tags"] == "a,b,c"
        assert row["project_name"] == "proj"
        assert row["session_id"] == "sess123"
        assert row["file_path"] == "/abs/path"

    def test_add_invalid_type_rejected(self, tmp_db, capsys):
        rc = notes.cmd_add(_ns(title="x", type="bogus"))
        assert rc == 1
        assert "type must be one of" in capsys.readouterr().err

    def test_add_json_output(self, tmp_db, capsys):
        rc = notes.cmd_add(_ns(title="x", json=True))
        assert rc == 0
        out = json.loads(capsys.readouterr().out)
        assert out["id"] == 1
        assert "created_at" in out


class TestNotesList:
    def test_list_empty(self, tmp_db, capsys):
        rc = notes.cmd_list(_ns())
        assert rc == 0
        assert "(no notes)" in capsys.readouterr().out

    def test_list_returns_recent_first(self, tmp_db, capsys):
        for i in range(3):
            notes.cmd_add(_ns(title=f"n{i}"))
        capsys.readouterr()  # drain
        notes.cmd_list(_ns(limit=10))
        out = capsys.readouterr().out
        # most recent first
        assert out.index("n2") < out.index("n1") < out.index("n0")

    def test_list_filter_by_project(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="a", project="alpha"))
        notes.cmd_add(_ns(title="b", project="beta"))
        capsys.readouterr()
        notes.cmd_list(_ns(project="alpha"))
        out = capsys.readouterr().out
        assert "a" in out and "[note] b" not in out

    def test_list_filter_by_tag(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="x", tags="foo,bar"))
        notes.cmd_add(_ns(title="y", tags="baz"))
        capsys.readouterr()
        notes.cmd_list(_ns(tag="foo"))
        out = capsys.readouterr().out
        assert "x" in out and "y" not in out

    def test_list_filter_tag_does_not_match_substring(self, tmp_db, capsys):
        # "foo" must not match "foobar" -- the tag is comma-bounded
        notes.cmd_add(_ns(title="x", tags="foobar"))
        capsys.readouterr()
        notes.cmd_list(_ns(tag="foo"))
        out = capsys.readouterr().out
        assert "(no notes)" in out


class TestNotesGet:
    def test_get_existing(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="hello", body="world"))
        capsys.readouterr()
        rc = notes.cmd_get(_ns(id=1))
        assert rc == 0
        out = capsys.readouterr().out
        assert "hello" in out and "world" in out

    def test_get_missing_returns_2(self, tmp_db, capsys):
        rc = notes.cmd_get(_ns(id=999))
        assert rc == 2


class TestNotesSearch:
    def test_search_by_title(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="auth bug"))
        notes.cmd_add(_ns(title="webhook"))
        capsys.readouterr()
        notes.cmd_search(_ns(query="auth"))
        out = capsys.readouterr().out
        assert "auth bug" in out and "webhook" not in out

    def test_search_by_body(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="x", body="this mentions postgres"))
        capsys.readouterr()
        notes.cmd_search(_ns(query="postgres"))
        assert "x" in capsys.readouterr().out


class TestNotesDelete:
    def test_delete_requires_yes(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="x"))
        capsys.readouterr()
        rc = notes.cmd_delete(_ns(id=1, yes=False))
        assert rc == 1
        # row still there
        with sqlite3.connect(str(tmp_db)) as conn:
            assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 1

    def test_delete_with_yes(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="x"))
        capsys.readouterr()
        rc = notes.cmd_delete(_ns(id=1, yes=True))
        assert rc == 0
        with sqlite3.connect(str(tmp_db)) as conn:
            assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 0

    def test_delete_missing_returns_2(self, tmp_db, capsys):
        rc = notes.cmd_delete(_ns(id=42, yes=True))
        assert rc == 2


class TestNotesUpdate:
    def test_update_title(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="orig"))
        capsys.readouterr()
        rc = notes.cmd_update(_ns(id=1, title="new"))
        assert rc == 0
        with sqlite3.connect(str(tmp_db)) as conn:
            row = conn.execute("SELECT title FROM notes WHERE id = 1").fetchone()
        assert row[0] == "new"

    def test_update_no_fields_errors(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="x"))
        capsys.readouterr()
        rc = notes.cmd_update(_ns(id=1))
        assert rc == 1

    def test_update_invalid_type(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="x"))
        capsys.readouterr()
        rc = notes.cmd_update(_ns(id=1, type="garbage"))
        assert rc == 1

    def test_update_missing_returns_2(self, tmp_db, capsys):
        rc = notes.cmd_update(_ns(id=99, title="x"))
        assert rc == 2

    def test_update_bumps_updated_at(self, tmp_db, capsys):
        notes.cmd_add(_ns(title="x"))
        capsys.readouterr()
        with sqlite3.connect(str(tmp_db)) as conn:
            before = conn.execute("SELECT updated_at FROM notes WHERE id = 1").fetchone()[0]
        notes.cmd_update(_ns(id=1, title="y"))
        with sqlite3.connect(str(tmp_db)) as conn:
            after = conn.execute("SELECT updated_at FROM notes WHERE id = 1").fetchone()[0]
        assert after >= before


# ===========================================================================
# file_cooccurrences view (schema v3)
# ===========================================================================


def _seed_cooccurrence_data(db_path: pathlib.Path) -> None:
    """Populate sessions + tool_calls so the view has something to compute over."""
    notes.db_connect().close()  # apply schema
    with sqlite3.connect(str(db_path)) as conn:
        conn.executemany(
            "INSERT INTO sessions (id, project_name, is_subagent) VALUES (?,?,0)",
            [("s1", "p"), ("s2", "p"), ("s3", "p")],
        )
        rows = [
            # session 1: a + b + c
            ("s1", "Edit", "/path/a.py", "2026-01-01T00:00:00Z"),
            ("s1", "Edit", "/path/b.py", "2026-01-01T00:01:00Z"),
            ("s1", "Read", "/path/c.py", "2026-01-01T00:02:00Z"),
            # session 2: a + b
            ("s2", "Edit", "/path/a.py", "2026-01-02T00:00:00Z"),
            ("s2", "Read", "/path/b.py", "2026-01-02T00:01:00Z"),
            # session 3: only c (no pair to anything but itself, excluded by a < b)
            ("s3", "Edit", "/path/c.py", "2026-01-03T00:00:00Z"),
            # bash call -- must be ignored by the view
            ("s1", "Bash", "ls -la", "2026-01-01T00:03:00Z"),
        ]
        conn.executemany(
            "INSERT INTO tool_calls (session_id, tool_name, input_summary, timestamp) VALUES (?,?,?,?)",
            rows,
        )


class TestFileCooccurrencesView:
    def test_view_canonicalizes_pairs(self, tmp_db):
        _seed_cooccurrence_data(tmp_db)
        with sqlite3.connect(str(tmp_db)) as conn:
            pairs = conn.execute(
                "SELECT file_a, file_b FROM file_cooccurrences ORDER BY file_a, file_b"
            ).fetchall()
        # a < b < c, so canonical pairs are (a,b), (a,c), (b,c) -- but only if
        # both files appeared together in at least one session. c was alone in s3.
        assert ("/path/a.py", "/path/b.py") in pairs
        assert ("/path/a.py", "/path/c.py") in pairs
        assert ("/path/b.py", "/path/c.py") in pairs
        # never (b, a) -- only canonical direction
        assert ("/path/b.py", "/path/a.py") not in pairs

    def test_session_count_aggregates(self, tmp_db):
        _seed_cooccurrence_data(tmp_db)
        with sqlite3.connect(str(tmp_db)) as conn:
            count = conn.execute(
                "SELECT session_count FROM file_cooccurrences "
                "WHERE file_a = '/path/a.py' AND file_b = '/path/b.py'"
            ).fetchone()[0]
        assert count == 2  # s1 and s2

    def test_view_excludes_bash(self, tmp_db):
        _seed_cooccurrence_data(tmp_db)
        with sqlite3.connect(str(tmp_db)) as conn:
            rows = conn.execute(
                "SELECT * FROM file_cooccurrences WHERE file_a LIKE '%ls%' OR file_b LIKE '%ls%'"
            ).fetchall()
        assert rows == []

    def test_last_seen_takes_max_across_pair(self, tmp_db):
        _seed_cooccurrence_data(tmp_db)
        with sqlite3.connect(str(tmp_db)) as conn:
            last = conn.execute(
                "SELECT last_seen FROM file_cooccurrences "
                "WHERE file_a = '/path/a.py' AND file_b = '/path/b.py'"
            ).fetchone()[0]
        # latest a-touch was 2026-01-02T00:00:00Z, latest b-touch was 2026-01-02T00:01:00Z
        assert last == "2026-01-02T00:01:00Z"


# ===========================================================================
# notes table schema sanity
# ===========================================================================


class TestNotesSchema:
    def test_schema_version_is_3(self, tmp_db):
        notes.db_connect().close()
        with sqlite3.connect(str(tmp_db)) as conn:
            v = conn.execute("SELECT value FROM meta WHERE key = 'schema_version'").fetchone()[0]
        assert v == "3"

    def test_default_note_type_is_note(self, tmp_db):
        notes.db_connect().close()
        with sqlite3.connect(str(tmp_db)) as conn:
            conn.execute("INSERT INTO notes (title) VALUES ('x')")
            row = conn.execute("SELECT note_type FROM notes").fetchone()
        assert row[0] == "note"

    def test_indexes_exist(self, tmp_db):
        notes.db_connect().close()
        with sqlite3.connect(str(tmp_db)) as conn:
            idx = {
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'notes'"
                )
            }
        for expected in ("idx_notes_project", "idx_notes_session", "idx_notes_type", "idx_notes_created"):
            assert expected in idx, f"missing index {expected}"
