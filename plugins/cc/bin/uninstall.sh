#!/usr/bin/env bash
# tested with: claude code v2.1.118
# cascade-uninstall the cc plugin: kills any running cc-server, clears
# runtime state, drops version cache, and disables the plugin in
# settings.local.json. Idempotent and safe to run multiple times.
#
# Usage:
#   bash bin/uninstall.sh                       # interactive (default)
#   bash bin/uninstall.sh --yes                 # skip confirmation
#   bash bin/uninstall.sh --keep-data           # keep ~/.claude/cc/ data
#
# After this runs, restart Claude Code so any in-process MCP child is
# torn down. Reinstall via:
#   /plugin install cc@cc
#
# This script is intentionally a peer to bin/launch.sh -- it should keep
# working even when the plugin is partially installed or in a weird
# state, so we avoid sourcing other plugin files and stay POSIX-shell
# friendly.
set -euo pipefail

YES=0
KEEP_DATA=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --keep-data) KEEP_DATA=1 ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# v3.0+ canonical state path; v2 path kept as fallback for users who haven't
# upgraded yet. The server migrates v2 -> v3 on first start, so post-upgrade
# the v2 path is a symlink we don't want to delete (it still resolves).
CC_DATA_DIR_V3="$CLAUDE_DIR/channels/cc"
CC_DATA_DIR_V2="$CLAUDE_DIR/cc"
CC_DATA_DIR=""
if [ -d "$CC_DATA_DIR_V3" ] && [ ! -L "$CC_DATA_DIR_V3" ]; then
  CC_DATA_DIR="$CC_DATA_DIR_V3"
elif [ -d "$CC_DATA_DIR_V2" ] && [ ! -L "$CC_DATA_DIR_V2" ]; then
  CC_DATA_DIR="$CC_DATA_DIR_V2"
fi
PLUGIN_CACHE="$CLAUDE_DIR/plugins/cache/cc/cc"
SETTINGS_LOCAL="$CLAUDE_DIR/settings.local.json"

echo "cc plugin cascade uninstall"
echo "==========================="
echo "claude config dir : $CLAUDE_DIR"
echo "runtime data      : ${CC_DATA_DIR:-(absent)}"
echo "plugin cache      : $PLUGIN_CACHE $([ -d "$PLUGIN_CACHE" ] && echo '(exists)' || echo '(absent)')"
echo "settings.local    : $SETTINGS_LOCAL $([ -f "$SETTINGS_LOCAL" ] && echo '(exists)' || echo '(absent)')"

# v3 changes how cc is launched: was `bash launch.sh` -> `bun /full/path/to/server.ts`,
# now `bun run --silent start` -> `bun server.ts` (no path on argv). The v2
# pgrep pattern that matched `/plugins/cc/server\.ts` no longer catches
# anything. Canonical source of truth instead: read live pids from the cc
# database (sessions.pid where ended_at_ms IS NULL). Falls through to the
# legacy regex for any process the DB missed (e.g. orphans from a hard
# crash that wiped the row).
RUNNING_PIDS=()
if [ -n "$CC_DATA_DIR" ] && [ -f "$CC_DATA_DIR/sessions.db" ] && command -v sqlite3 >/dev/null 2>&1; then
  while IFS= read -r pid; do
    [ -n "$pid" ] && RUNNING_PIDS+=("$pid")
  done < <(sqlite3 -noheader "$CC_DATA_DIR/sessions.db" \
    "SELECT pid FROM sessions WHERE ended_at_ms IS NULL AND pid IS NOT NULL;" 2>/dev/null)
fi
# Legacy regex catch-net for orphans (compiled binary names + plugin-source path).
PROC_RE_LEGACY='cc-server-darwin|cc-server-linux|cc-server$|/plugins/cc/server\.ts|/plugins/cache/cc/cc/.*/server\.ts'
while IFS= read -r pid; do
  [ -n "$pid" ] && RUNNING_PIDS+=("$pid")
done < <(pgrep -f "$PROC_RE_LEGACY" 2>/dev/null || true)
# Dedupe + filter out our own pid.
declare -A SEEN=()
FILTERED=()
for pid in "${RUNNING_PIDS[@]}"; do
  [ "$pid" = "$$" ] && continue
  [ -n "${SEEN[$pid]:-}" ] && continue
  SEEN[$pid]=1
  # Verify the pid actually exists before claiming it.
  kill -0 "$pid" 2>/dev/null || continue
  FILTERED+=("$pid")
done
RUNNING_PIDS=("${FILTERED[@]}")

if [ ${#RUNNING_PIDS[@]} -gt 0 ]; then
  echo "running processes :"
  for pid in "${RUNNING_PIDS[@]}"; do
    cmd=$(ps -p "$pid" -o command= 2>/dev/null | head -1)
    printf "                    %s  %s\n" "$pid" "$cmd"
  done
else
  echo "running processes : none"
fi
echo

if [ "$YES" -ne 1 ]; then
  printf "proceed? [y/N] "
  read -r REPLY
  case "$REPLY" in y|Y|yes|YES) ;; *) echo "aborted"; exit 0 ;; esac
fi

# 1. stop any running cc-server processes (DB-discovered + regex orphans)
if [ ${#RUNNING_PIDS[@]} -gt 0 ]; then
  echo "[1/4] stopping ${#RUNNING_PIDS[@]} cc-server process(es)..."
  # Detect "we're inside a parent Claude Code that owns this MCP child":
  # if any pid's ppid runs the 'claude' binary, warn -- killing only
  # buys a second of peace before the parent respawns it.
  parent_warn=0
  for cc_pid in "${RUNNING_PIDS[@]}"; do
    ppid=$(ps -o ppid= -p "$cc_pid" 2>/dev/null | tr -d ' ')
    if [ -n "$ppid" ] && ps -o command= -p "$ppid" 2>/dev/null | grep -q -E 'claude|Claude'; then
      parent_warn=1; break
    fi
  done
  if [ "$parent_warn" -eq 1 ]; then
    echo "      WARNING: an MCP child of a running Claude Code parent was found."
    echo "      It will be killed, but the parent CC may respawn it on the next"
    echo "      tool call and recreate runtime state. Restart Claude Code"
    echo "      after this script completes for a true reset."
  fi
  # graceful first, then force.
  for pid in "${RUNNING_PIDS[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 1
  for pid in "${RUNNING_PIDS[@]}"; do kill -KILL "$pid" 2>/dev/null || true; done
  echo "      stopped"
else
  echo "[1/4] no cc-server processes -- skipped"
fi

# 2. wipe runtime data (db, inbox, topics, questions). honors --keep-data.
# Removes BOTH v3 path (~/.claude/channels/cc/) and v2 path (~/.claude/cc/)
# if either still exists; the v2 path may be a real dir on never-upgraded
# installs or a symlink left by the migration in db/migrate.ts.
if [ "$KEEP_DATA" -eq 1 ]; then
  echo "[2/4] keeping runtime data -- skipped"
else
  removed=0
  if [ -d "$CC_DATA_DIR_V3" ] || [ -L "$CC_DATA_DIR_V3" ]; then
    echo "[2/4] removing runtime data: $CC_DATA_DIR_V3"
    rm -rf "$CC_DATA_DIR_V3"
    removed=1
  fi
  if [ -L "$CC_DATA_DIR_V2" ]; then
    echo "      removing legacy symlink: $CC_DATA_DIR_V2"
    rm -f "$CC_DATA_DIR_V2"
    removed=1
  elif [ -d "$CC_DATA_DIR_V2" ]; then
    echo "      removing legacy data dir: $CC_DATA_DIR_V2"
    rm -rf "$CC_DATA_DIR_V2"
    removed=1
  fi
  if [ "$removed" -eq 0 ]; then
    echo "[2/4] no runtime data -- skipped"
  else
    echo "      done"
  fi
fi

# 3. drop version cache. the marketplace cache is shared across plugins
# in the same marketplace; we only delete the cc/cc/ subtree, not the
# whole marketplace.
if [ -d "$PLUGIN_CACHE" ]; then
  echo "[3/4] removing plugin cache: $PLUGIN_CACHE"
  rm -rf "$PLUGIN_CACHE"
  echo "      done"
else
  echo "[3/4] no plugin cache -- skipped"
fi

# 4. disable the plugin in settings.local.json. We use python3 to edit
# the JSON in-place so we don't depend on jq being installed.
if [ -f "$SETTINGS_LOCAL" ] && command -v python3 >/dev/null 2>&1; then
  python3 - "$SETTINGS_LOCAL" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    data = json.load(f)
ep = data.get("enabledPlugins", {})
removed = []
for key in list(ep.keys()):
    if key == "cc@cc" or key.startswith("cc@"):
        del ep[key]; removed.append(key)
if not ep and "enabledPlugins" in data:
    del data["enabledPlugins"]
elif "enabledPlugins" in data:
    data["enabledPlugins"] = ep
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(f"[4/4] settings.local.json: removed {removed or 'nothing (cc not enabled)'}")
PY
else
  echo "[4/4] settings.local.json missing or python3 unavailable -- skipped"
fi

echo
echo "uninstall complete. next steps:"
echo "  1. restart Claude Code so the MCP child process is torn down"
echo "  2. (optional) /plugin install cc@cc to reinstall fresh"
