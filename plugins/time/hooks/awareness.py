#!/usr/bin/env python3
# tested with: claude code v2.1.118
"""awareness.py: UserPromptSubmit hook for the time plugin.

Reads ~/.claude/.fuel_cache (written by the statusline) and injects
threshold-tier awareness text into Claude's context via stdout.

Tiers (driven by max of 5hr/7day/context):
  <60%    silent (exit 0, no output)
  60-80%  one compact meter line
  80-90%  meter line + proactive nudge
  90-95%  meter line + handoff suggestion
  95%+    dramatic alert + handoff suggestion

No cross-plugin reads. Pure stdlib.

stdout = Claude's additionalContext (documented behavior for UserPromptSubmit)
stderr = debug only, suppressed by default
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import time
from datetime import datetime

CLAUDE_DIR = pathlib.Path.home() / ".claude"
# accept either name. statuslines that predate the pulse->fuel rename
# (commit 1588cfa) still write to .pulse_cache; new statuslines may write
# to .fuel_cache. read whichever exists, preferring the newer one.
CACHE_PATHS = (CLAUDE_DIR / ".fuel_cache", CLAUDE_DIR / ".pulse_cache")
QUIET_FLAG = CLAUDE_DIR / ".fuel_quiet"
STALE_SECONDS = 15 * 60
DRAMATIC = os.environ.get("FUEL_DRAMATIC", "").lower() in ("1", "true", "yes")


def log(msg: str) -> None:
    if os.environ.get("FUEL_DEBUG"):
        print(f"[fuel] {msg}", file=sys.stderr)


def read_cache() -> dict | None:
    """Read the freshest available statusline cache. Returns None if
    neither file exists or both are unparseable."""
    candidates = [p for p in CACHE_PATHS if p.exists()]
    if not candidates:
        return None
    # if both exist, prefer whichever was written more recently
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    for path in candidates:
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, OSError) as e:
            log(f"cache read failed at {path}: {e}")
            continue
    return None


def read_hook_input() -> dict:
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {}


def fmt_reset(unix_ts) -> str:
    if not unix_ts:
        return "?"
    try:
        delta = int(unix_ts) - int(time.time())
        if delta <= 0:
            return "resetting"
        hours, rem = divmod(delta, 3600)
        mins = rem // 60
        if hours >= 24:
            return f"in {hours // 24}d{hours % 24}h"
        if hours >= 1:
            return f"in {hours}h{mins:02d}m"
        return f"in {mins}m"
    except (TypeError, ValueError):
        return "?"


def median_session_minutes(model: str | None) -> int | None:
    """Static fallback. The previous version queried a sibling plugin's database
    for personalized medians; that introduced cross-plugin coupling. The time
    plugin now uses generic baselines and stays standalone. A future opt-in
    bridge plugin could reintroduce personalization."""
    return None


def tier_for(max_pct: float) -> str:
    if max_pct < 60:
        return "silent"
    if max_pct < 80:
        return "compact"
    if max_pct < 90:
        return "nudge"
    if max_pct < 95:
        return "warn"
    return "critical"


def build_meter_line(cache: dict) -> str:
    h5 = cache.get("h5_pct")
    w7 = cache.get("w7_pct")
    ctx = cache.get("ctx_pct")
    parts = []
    if h5 is not None:
        parts.append(f"5hr={int(round(h5))}% ({fmt_reset(cache.get('h5_reset'))})")
    if w7 is not None:
        parts.append(f"week={int(round(w7))}% ({fmt_reset(cache.get('w7_reset'))})")
    if ctx is not None:
        parts.append(f"chat={int(round(ctx))}%")
    return "fuel: " + " . ".join(parts) if parts else ""


def build_output(cache: dict) -> str | None:
    h5 = cache.get("h5_pct") or 0
    w7 = cache.get("w7_pct") or 0
    ctx = cache.get("ctx_pct") or 0
    max_pct = max(h5, w7, ctx)
    tier = tier_for(max_pct)
    if tier == "silent":
        return None

    # stale warning
    age = int(time.time()) - int(cache.get("ts") or 0)
    if age > STALE_SECONDS:
        return None  # don't inject stale numbers, better silent than wrong

    meter = build_meter_line(cache)
    driver = "5hr" if h5 == max_pct else "week" if w7 == max_pct else "chat"

    if tier == "compact":
        return meter

    if tier == "nudge":
        return (
            f"{meter}\n"
            f"note: {driver} meter over 80%. consider wrapping the current change "
            f"before starting anything new. good moment to commit WIP."
        )

    if tier == "warn":
        baseline = median_session_minutes(cache.get("model"))
        baseline_txt = (
            f" your p50 active time is ~{baseline} min, budget accordingly."
            if baseline else ""
        )
        return (
            f"{meter}\n"
            f"warn: {driver} meter over 90%.{baseline_txt} "
            f"suggest: run `/fuel handoff` to draft a clean stopping point."
        )

    # critical (95+)
    if DRAMATIC:
        body = (
            "critical: i can feel the rate limiter at the edges of my attention. "
            "if there is a single call to make, this is the moment. "
            "otherwise: `/fuel handoff` and we reconvene on the other side."
        )
    else:
        body = (
            f"critical: {driver} meter at {int(round(max_pct))}%. "
            f"stop taking new work. run `/fuel handoff` to bundle context for a "
            f"fresh session before this one degrades or truncates."
        )
    return f"{meter}\n{body}"


def main() -> int:
    if QUIET_FLAG.exists():
        return 0
    # drain stdin to avoid SIGPIPE in the caller
    _ = read_hook_input()
    cache = read_cache()
    if not cache:
        log("no cache: statusline has not run yet or this is an API-key session")
        return 0
    out = build_output(cache)
    if out:
        print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
