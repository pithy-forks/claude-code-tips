#!/usr/bin/env bash
# tested with: claude code v2.1.118
# launcher for the cc MCP server.
#
# claude code parses ${VAR} substitutions in plugin.json args before
# executing the command, so dynamic shell logic must live in a script
# (where variables are local to bash, not the manifest).
#
# preference order:
#   1. compiled binary at dist/cc-server-${os}-${arch} (zero install)
#   2. node_modules already present in plugin root → exec via bun
#   3. fall through to a `bun install` then exec via bun
#
# the source path always works; binaries are an opt-in optimization.
set -eo pipefail

ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DATA="${CLAUDE_PLUGIN_DATA:-}"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
  x86_64) ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) ARCH="$ARCH_RAW" ;;
esac

BIN="$ROOT/dist/cc-server-${OS}-${ARCH}"
if [ -x "$BIN" ]; then
  exec "$BIN"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "cc plugin: bun runtime not found on PATH. install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

if [ ! -d "$ROOT/node_modules" ]; then
  if [ -n "$DATA" ] && [ -d "$DATA/node_modules" ]; then
    ln -sfn "$DATA/node_modules" "$ROOT/node_modules" 2>/dev/null || true
  fi
fi

if [ ! -d "$ROOT/node_modules" ]; then
  (cd "$ROOT" && bun install --silent)
fi

exec bun "$ROOT/server.ts"
