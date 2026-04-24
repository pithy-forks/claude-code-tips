# tested with: claude code v2.1.118
"""Argos-backed README translator used as the fallback when ANTHROPIC_API_KEY is unset.

Extracts prose from markdown, translates only prose, reassembles verbatim.
Structural lines (fences, tables, HTML, badges, link-only, blank, selector) stay
byte-for-byte. Headings keep their `#+ ` prefix. Soft-fails per-line so one bad
sentence cannot nuke the whole README.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# --- markdown line classifier ------------------------------------------------

# lines we preserve verbatim (no translation at all)
_RE_SELECTOR = re.compile(r"^>\s*\[[A-Z]{2}\]\(.*\)\s*\|")
_RE_BADGE = re.compile(r"^\[!\[")
_RE_HTML_OPEN = re.compile(r"^\s*<[a-zA-Z/!]")
_RE_TABLE = re.compile(r"^\s*\|")
_RE_HR = re.compile(r"^\s*---+\s*$")
_RE_LINK_ONLY = re.compile(
    r"^\s*\[[^\]]+\]\([^)]+\)\s*(?:[&][a-z]+;|\||·|•|,)?\s*"
    r"(?:(?:[&][a-z]+;|\||·|•|,)\s*\[[^\]]+\]\([^)]+\)\s*(?:[&][a-z]+;|\||·|•|,)?\s*)*$"
)
# heading: capture prefix and text
_RE_HEADING = re.compile(r"^(#{1,6}\s+)(.*\S)\s*$")
# link-row that is actually navigation (e.g. `[vs cursor](...) · [vs codex](...)`) — treat as link-only


def classify(line: str, in_fence: bool) -> str:
    """Return one of: fence_toggle, fence_body, preserve, heading, prose."""
    if line.startswith("```"):
        return "fence_toggle"
    if in_fence:
        return "fence_body"
    stripped = line.strip()
    if not stripped:
        return "preserve"
    if _RE_SELECTOR.match(stripped):
        return "preserve"
    if _RE_BADGE.match(stripped):
        return "preserve"
    if _RE_HTML_OPEN.match(line):
        return "preserve"
    if _RE_TABLE.match(line):
        return "table"
    if _RE_HR.match(stripped):
        return "preserve"
    if _RE_HEADING.match(line):
        return "heading"
    if _RE_LINK_ONLY.match(stripped):
        return "preserve"
    return "prose"


# --- table-cell translation --------------------------------------------------

def translate_table_row(row: str, translate_fn) -> str:
    """Translate each cell's prose while keeping pipes and link syntax."""
    # separator rows like |---|---| stay verbatim
    if re.match(r"^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$", row):
        return row
    # split on pipes, keep leading/trailing whitespace structure
    parts = row.split("|")
    translated = []
    for part in parts:
        # skip empty border pieces (from leading/trailing |)
        if part.strip() == "":
            translated.append(part)
            continue
        # if the cell is ONLY a link or code, keep it
        s = part.strip()
        if _RE_LINK_ONLY.match(s) or (s.startswith("`") and s.endswith("`")):
            translated.append(part)
            continue
        translated.append(_translate_preserving_whitespace(part, translate_fn))
    return "|".join(translated)


# --- prose translation -------------------------------------------------------

def _translate_preserving_whitespace(text: str, translate_fn) -> str:
    """Translate text while preserving leading and trailing whitespace."""
    leading = len(text) - len(text.lstrip())
    trailing = len(text) - len(text.rstrip())
    core = text[leading: len(text) - trailing] if trailing else text[leading:]
    if not core:
        return text
    try:
        translated = translate_fn(core)
    except Exception as e:  # argos occasionally chokes on weird input
        print(f"::warning::line translation failed, keeping english: {e}", file=sys.stderr)
        translated = core
    return text[:leading] + translated + (text[-trailing:] if trailing else "")


def translate_prose(line: str, translate_fn) -> str:
    return _translate_preserving_whitespace(line, translate_fn)


def translate_heading(line: str, translate_fn) -> str:
    m = _RE_HEADING.match(line)
    if not m:
        return line
    prefix, text = m.group(1), m.group(2)
    try:
        translated = translate_fn(text)
    except Exception:
        translated = text
    return f"{prefix}{translated}\n"


# --- argos bootstrap ---------------------------------------------------------

def install_package(from_code: str, to_code: str) -> None:
    import argostranslate.package as pkg
    pkg.update_package_index()
    available = pkg.get_available_packages()
    match = next((p for p in available if p.from_code == from_code and p.to_code == to_code), None)
    if match is None:
        raise SystemExit(f"argos: no package for {from_code}->{to_code}")
    # only download if not already installed
    installed = {(p.from_code, p.to_code) for p in pkg.get_installed_packages()}
    if (from_code, to_code) not in installed:
        path = match.download()
        pkg.install_from_path(path)


def get_translator(from_code: str, to_code: str):
    import argostranslate.translate as tr
    fn = lambda s: tr.translate(s, from_code, to_code)
    # warmup: argos lazy-loads on first call
    fn("hello")
    return fn


# --- main --------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", required=True)
    ap.add_argument("--to", dest="dst", required=True)
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="outp", required=True)
    ap.add_argument("--selector", required=True, help="language selector line to prepend")
    ap.add_argument("--hash", required=True, help="short source git hash for trailer")
    args = ap.parse_args()

    install_package(args.src, args.dst)
    translate_fn = get_translator(args.src, args.dst)

    src = Path(args.inp).read_text(encoding="utf-8")
    out_lines: list[str] = []
    in_fence = False

    # always-present header: language selector on line 1, then blank line
    out_lines.append(args.selector.rstrip() + "\n")
    out_lines.append("\n")

    # drop leading selector + blank from source if present (we replace it)
    raw_lines = src.splitlines(keepends=True)
    start = 0
    if raw_lines and _RE_SELECTOR.match(raw_lines[0].strip()):
        start = 1
        if len(raw_lines) > 1 and raw_lines[1].strip() == "":
            start = 2

    for line in raw_lines[start:]:
        kind = classify(line, in_fence)
        if kind == "fence_toggle":
            in_fence = not in_fence
            out_lines.append(line)
        elif kind in ("fence_body", "preserve"):
            out_lines.append(line)
        elif kind == "heading":
            out_lines.append(translate_heading(line, translate_fn))
        elif kind == "table":
            out_lines.append(translate_table_row(line.rstrip("\n"), translate_fn) + ("\n" if line.endswith("\n") else ""))
        else:  # prose
            out_lines.append(translate_prose(line, translate_fn))

    # source-hash trailer
    if not out_lines[-1].endswith("\n"):
        out_lines.append("\n")
    out_lines.append("\n")
    out_lines.append(f"<!-- translated from README.md @ {args.hash} -->\n")

    Path(args.outp).write_text("".join(out_lines), encoding="utf-8")
    print(f"wrote {args.outp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
