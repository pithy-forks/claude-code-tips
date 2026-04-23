# changelog

## 2026-04-22

### cc plugin v2.1.0
- time subsystem folded in: a `time` rule, SessionStart `time-project-hint` hook, and three skills (`/time-estimate`, `/time-calibrate`, `/time-benchmark`)
- rule content: bimodal session modes (quick, standard, marathon), model x effort throughput matrix (Opus 4.7/4.6/Sonnet 4.6 x low/medium/high/xhigh/max, Haiku 4.5 no-effort), 3-tier parallelism (main agent, subagent via Task, agent teammate via experimental agent-teams), relaxed compaction warnings for the 1M context era
- hook: reads `~/.claude/mine.db` if present, resolves cwd to git repo root, injects last-5-sessions-in-project timing on SessionStart, silent on missing db or zero matches, exits 0 on any failure path
- skills resolve model and effort level at call time (dynamic), so estimates match your actual `/effort` setting

### naming
- subsystem renamed from `claude-time` to `time` (now under the cc namespace: `plugins/cc/rules/time.md`, `/cc:time-*` skill paths). Legacy references retired; historical artifacts (commit history, backups) untouched.

### versions
- `plugins/cc/.claude-plugin/plugin.json`, `plugins/cc/server.ts`, and top-level `.claude-plugin/plugin.json` aligned to 2.1.0 to match marketplace metadata

## 2026-03-15

### mine plugin
- renamed plugin: miner → mine
- renamed features: scar → mistakes
- removed: gauge (regex model advisor)
- added: burn cost-anomaly hook (fires on PreCompact)
- added: hotspots and loops query intents
- updated parser with user-centric metrics
- added 125-test suite (pytest)

### new tools
- live session dashboard (`scripts/dashboard.py`) — textual TUI
- replay capture hook + /replay command
- /dashboard slash command

### docs
- refreshed all 5 comparison docs with current pricing
- updated guide, cost analysis, troubleshooting, glossary

### CI
- fixed broken paths in docs-audit.yml and validate.yml
- added upstream-watcher PR permission docs
- added tests/ to python-check validation

### infra
- added .gitleaks.toml for test fixture allowlisting

## 2026-03-08

### initial release
- mine plugin v1.0: search, mistakes, burn, hotspots, loops
- 19 docs covering beginner to advanced claude code patterns
- 9 slash commands, 8 agents
- 8 CI workflows for autonomous maintenance
- standalone hooks: safety-guard, panopticon, context-save, notify

<!-- tested with: claude code v2.1.94+ -->
