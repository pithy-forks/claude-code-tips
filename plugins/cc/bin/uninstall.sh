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
CC_DATA_DIR="$CLAUDE_DIR/cc"
PLUGIN_CACHE="$CLAUDE_DIR/plugins/cache/cc/cc"
SETTINGS_LOCAL="$CLAUDE_DIR/settings.local.json"

echo "cc plugin cascade uninstall"
echo "==========================="
echo "claude config dir : $CLAUDE_DIR"
echo "runtime data      : $CC_DATA_DIR $([ -d "$CC_DATA_DIR" ] && echo '(exists)' || echo '(absent)')"
echo "plugin cache      : $PLUGIN_CACHE $([ -d "$PLUGIN_CACHE" ] && echo '(exists)' || echo '(absent)')"
echo "settings.local    : $SETTINGS_LOCAL $([ -f "$SETTINGS_LOCAL" ] && echo '(exists)' || echo '(absent)')"
RUNNING=$(pgrep -fl 'cc-server-darwin\|cc-server-linux\|cc/server.ts\|cc/dist/cc-server' 2>/dev/null || true)
if [ -n "$RUNNING" ]; then
  echo "running processes :"
  echo "$RUNNING" | sed 's/^/                    /'
else
  echo "running processes : none"
fi
echo

if [ "$YES" -ne 1 ]; then
  printf "proceed? [y/N] "
  read -r REPLY
  case "$REPLY" in y|Y|yes|YES) ;; *) echo "aborted"; exit 0 ;; esac
fi

# 1. stop any running cc-server processes (compiled binary + bun source)
if [ -n "$RUNNING" ]; then
  echo "[1/4] stopping cc-server processes..."
  # graceful first, then force
  pkill -TERM -f 'cc-server-darwin\|cc-server-linux\|cc/server.ts\|cc/dist/cc-server' 2>/dev/null || true
  sleep 1
  pkill -KILL -f 'cc-server-darwin\|cc-server-linux\|cc/server.ts\|cc/dist/cc-server' 2>/dev/null || true
  echo "      stopped"
else
  echo "[1/4] no cc-server processes -- skipped"
fi

# 2. wipe runtime data (db, inbox, topics, questions). honors --keep-data.
if [ "$KEEP_DATA" -eq 1 ]; then
  echo "[2/4] keeping runtime data ($CC_DATA_DIR) -- skipped"
elif [ -d "$CC_DATA_DIR" ]; then
  echo "[2/4] removing runtime data: $CC_DATA_DIR"
  rm -rf "$CC_DATA_DIR"
  echo "      done"
else
  echo "[2/4] no runtime data -- skipped"
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
