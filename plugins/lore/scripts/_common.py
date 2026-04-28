#!/usr/bin/env python3
# tested with: claude code v2.1.118
"""_common.py -- shared helpers for the lore plugin.

Imported by mine.py, hook.py, and anthropic_canonical.py to keep path
resolution, JSON loading, timestamp formatting, and legacy-file migration
in exactly one place.
"""

from __future__ import annotations

import json
import pathlib
import shutil
import sys
from datetime import datetime, timezone
from typing import Any, Iterable

CLAUDE_DIR = pathlib.Path.home() / ".claude"
LORE_DIR = CLAUDE_DIR / "lore"


def now_iso() -> str:
    """UTC ISO-8601 timestamp suitable for sqlite TEXT timestamps."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def prefer(new: pathlib.Path, legacy: pathlib.Path) -> pathlib.Path:
    """Return new if it exists; otherwise legacy if it exists; otherwise new
    as the canonical path for future writes."""
    if new.exists():
        return new
    if legacy.exists():
        return legacy
    return new


def safe_load_json(path: pathlib.Path) -> dict | None:
    """Load JSON from path. Return None if missing, unreadable, or not a dict."""
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None
    return data if isinstance(data, dict) else None


def migrate_legacy_files(
    target_dir: pathlib.Path,
    target_filename: str,
    legacy_paths: Iterable[pathlib.Path],
    *,
    move: bool = False,
    include_sqlite_companions: bool = False,
) -> tuple[pathlib.Path, pathlib.Path | None]:
    """Move or copy the first existing legacy_path to target_dir/target_filename.

    Strategy is uniform across mine.py and hook.py to prevent the previous
    divergence (one copied + retained, the other renamed + destroyed).

    Args:
        target_dir: created if missing
        target_filename: final basename under target_dir
        legacy_paths: tried in order; first existing wins
        move: if True, rename the source (legacy gone). if False, copy2 (legacy
              kept as backup so the user can verify before deleting)
        include_sqlite_companions: when True, also migrate -shm and -wal files
              alongside the primary file

    Returns: (target_path, source_used_or_None). Returns (target_path, None)
    when target already exists or no legacy source was found.
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / target_filename
    if target.exists():
        return target, None

    for source in legacy_paths:
        if not source.exists():
            continue
        if move:
            source.rename(target)
        else:
            shutil.copy2(str(source), str(target))
        if include_sqlite_companions:
            for suffix in ("-shm", "-wal"):
                companion_src = pathlib.Path(str(source) + suffix)
                companion_dst = pathlib.Path(str(target) + suffix)
                if companion_src.exists() and not companion_dst.exists():
                    if move:
                        companion_src.rename(companion_dst)
                    else:
                        shutil.copy2(str(companion_src), str(companion_dst))
        return target, source

    return target, None


def log_stderr(msg: str) -> None:
    """Single line to stderr with a [lore] tag. Used by hooks (where stdout
    is reserved for additionalContext) and by CLI tools (where stderr is the
    debug stream)."""
    print(f"[lore] {msg}", file=sys.stderr)
