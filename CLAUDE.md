# claude-code-tips

Claude Code plugins, hooks, agents, and resources. All tested.

## Structure

- `plugins/` — installable marketplace plugins (each has plugin.json + README + hook scripts)
- `hooks/` — standalone hook scripts with example config
- `docs/` — public documentation (hooks guide, plugin creation, subagent patterns)
- `agents/` — curated subagent definitions
- `skills/` — curated skill definitions
- `commands/` — slash command examples
- `content/` — GITIGNORED, personal drafts and experiments
- `.claude-plugin/` — makes this repo itself installable as a plugin

## Conventions

- All hook scripts use `#!/bin/bash` with `set -euo pipefail`
- Hook scripts read JSON from stdin via `jq`
- Exit codes: 0 = allow, 2 = block
- Each plugin is self-contained in its directory with its own README
- Documentation is practical and opinionated — no fluff

## Key files

- `marketplace.json` — enables claudemarketplaces.com auto-discovery
- `hooks/hooks.json` — example settings.json configuration for all hooks
- `docs/hooks-guide.md` — comprehensive hooks reference
