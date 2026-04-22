<!-- tested with: claude code v2.1.94 -->

# cc

cross-session messaging for claude code. see what other sessions are doing, send messages between them.

## install

```bash
/plugin marketplace add anipotts/claude-code-tips
/plugin install cc@cc
```

## usage

```
/cc                          show active sessions
/cc send merizo "pause"      message another session
```

messages arrive as `<channel source="cc" from="SESSION_NAME">` tags. sessions auto-register on start and clean up on exit.

## how it works

an MCP server (`server.ts`) uses `fs.watch()` for instant message delivery between sessions. each session gets an inbox directory. messages are delivered as files, watched in real-time, and cleaned up after reading.

## structure

- `.claude-plugin/plugin.json`: plugin manifest (MCP server)
- `server.ts`: MCP server (TypeScript, fs.watch)
- `hooks/cc-hook.mjs`: session lifecycle (register/cleanup)
- `hooks/time-project-hint.sh`: SessionStart hook, project-scoped timing hint
- `hooks/hooks.json`: hook event registrations
- `commands/cc.md`: `/cc` slash command
- `rules/time.md`: CC time budgeting rule (bimodal modes, model × effort matrix, 3 tiers of parallelism)
- `skills/time-estimate/SKILL.md`: `/time-estimate <task>` produces a ranged estimate with dynamic effort resolution
- `skills/time-calibrate/SKILL.md`: `/time-calibrate` measures your real throughput against the rule (needs `mine` plugin)
- `skills/time-benchmark/SKILL.md`: `/time-benchmark` walks a low/medium/high A/B/C test on your current model

## time

the `time` subsystem turns "how long will this take" into a grounded number. ships three pieces:

- **`rules/time.md`**: a rule auto-loaded into every session. frames CC active time vs your review time, bimodal session modes (quick / standard / marathon), model × effort multipliers, and three tiers of parallelism (main / subagent / teammate).
- **SessionStart hook**: when you start a session in a git repo, injects a one-line hint like `[cc timing · last 5 sessions in ~/my-proj] avg active: 23.6 min · avg tools: 61 · compaction: 0/5 (0%)`. silent no-op if `~/.claude/mine.db` is absent.
- **three skills**: `/time-estimate`, `/time-calibrate`, `/time-benchmark`.

### three skills

| skill | what |
|---|---|
| `/time-estimate <task>` | produces a CC-time range with effort-level rung cited, session mode named, your-time for review, confidence, and 2× risks. |
| `/time-calibrate` | reads `~/.claude/mine.db` (needs `mine` plugin), diffs your real throughput against the rule's matrix, flags drifts >15%. |
| `/time-benchmark` | guides an A/B/C across `/effort low`, `medium`, `high` on your current model. never auto-switches effort. |

### optional settings to pair with this plugin

documented here for your convenience. you apply them in your own `~/.claude/settings.json`, the plugin does not write to user settings.

- `"cleanupPeriodDays": 999999`: keep session transcripts so `mine` has data to mine and `/time-calibrate` has history. security caveat: transcripts contain plaintext prompts and outputs; FileVault + sensible filesystem permissions are the usual mitigation.
- `"effortLevel": "low" | "medium" | "high" | "xhigh"`: sets your default. `/time-estimate` reads this as precedence rung 4.
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (env): unlocks the third parallelism tier (agent teammates). see the rule for the speedup/cost trade.

### degradation matrix

| missing | what breaks |
|---|---|
| `~/.claude/mine.db` | SessionStart timing hint stays silent. `/time-calibrate` prints an install-suggestion screen. rule and `/time-estimate` unaffected. |
| `jq` | SessionStart hook silently exits 0. other paths unaffected. |
| `sqlite3` | same: silent exit. |
| `git` | hook falls back to literal cwd scope instead of repo root. still runs. |
| `mine` plugin | SessionStart hook still works if `mine.db` exists from an earlier install. `/time-calibrate` needs it for ongoing freshness. |

### rollback

uninstall: `/plugin uninstall cc`. the rule, hook, and three skills go with it. no user-settings changes to reverse.
