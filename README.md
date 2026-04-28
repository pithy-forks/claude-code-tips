> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub stars](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.122-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

claude code patterns, battle-tested across yc startups, public tech companies, and unicorns. maintained by someone who uses claude code as their job.

new here? start with the [tips index](./docs/tips/) or skim [hooks](./docs/hooks.md) and [automation](./docs/automation.md).

## what's inside

three plugins, one marketplace.

- **`lore@cc`** every session mined into sqlite. query costs, tools, errors, hotspots, loops, and full-text search across your own history. everything local.
- **`cc@cc`** cross-session awareness and messaging. plus a `time` subsystem: `/cc:time-estimate` gives realistic claude-code time grounded in your session history, not optimistic guesses.
- **`time@cc`** 3-meter fuel gauge (5-hour session, 7-day weekly, 200k context). pre-turn hook nudges claude toward cleaner handoffs as the meters fill. `/fuel state` reads them directly; `/fuel handoff` drafts a stopping point.

```
> /cc:time-estimate "rewrite auth middleware and add tests"
CC: ~22 min active (standard mode, Opus 4.7 high)
your time: ~15 min review
```

## quick start

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (one time)
/plugin install lore@cc                             # install lore (session analytics)
/plugin install cc@cc                               # install cc (cross-session messaging)
/plugin install time@cc                             # install time (fuel gauge + estimates)
```

then: copy [safety-guard.sh](./hooks/safety-guard.sh) to block dangerous commands. read a [tip](./docs/tips/). done.

---

## the numbers

hundreds of sessions across dozens of projects. $200/mo max plan.

same usage would cost ~$12K on the API with caching, ~$95K without. no autonomous loops. no cron jobs. every session starts with me typing a prompt. [how the cost math works &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="lore stats showing sessions, tokens, costs, and projects" />

---

## install the lore plugin

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (one time)
/plugin install lore@cc                             # install lore (session analytics)
/plugin install cc@cc                               # install cc (cross-session messaging)
/plugin install time@cc                             # install time (fuel gauge + estimates)
```

you get **[lore](./plugins/lore/)** · session mining to sqlite. costs, search, error memory, pattern detection. all data stays local at `~/.claude/lore/lore.db`.

```
/lore                     today's sessions, cost, top tools
/lore search "websocket"  full-text search across all conversations
/lore mistakes            error patterns claude keeps repeating
/lore hotspots            most-edited files across sessions
/lore loops               repeated patterns across sessions
```

start with `lore` + the `safety-guard` hook. add more as you go. **[lore docs &rarr;](./plugins/lore/)**

---

## cc plugin

cross-session messaging and the `time` subsystem. see what other claude code sessions are doing, send messages between them, and get realistic time estimates grounded in your own session history.

```bash
/plugin install cc@cc
```

```
/cc                             show active sessions
/cc send merizo "pause"         message another session
/cc:time-estimate <task>        ranged CC estimate, uses your current model + effort
/cc:time-calibrate              diff real throughput (from lore.db) against the rule
/cc:time-benchmark              guided A/B/C across effort levels on your model
```

---

## the 3 things that changed how i code

### hooks

hooks are the difference between "claude does what i want" and "claude does whatever it feels like." CLAUDE.md gives guidance. hooks give enforcement. one is a suggestion, the other is a wall.

this repo has 9 hooks you can drop into any project. safety-guard blocks force pushes, `rm -rf /`, and `curl | bash`. no-squash blocks squash merges. context-save preserves state before compaction. pick the ones that fit your workflow. [hook guide &rarr;](./docs/hooks.md)

### agent teams

multiple claude instances working simultaneously on the same codebase, each in its own git worktree. the coordinator assigns tasks, collects results, merges the best approach.

i use this for parallel research, trying risky changes safely, and comparing approaches side-by-side without touching my working tree. [how i use agent teams &rarr;](./docs/agents.md)

### prompt caching

this is why the $200/mo plan is the best deal in AI coding. claude code caches your system prompt, tools, and CLAUDE.md as a prefix. 91% of my input tokens hit the cache, meaning i pay 10% of the input cost on 91% of my reads.

the key: keep your CLAUDE.md short and stable. every edit breaks the prefix cache. mine is 30 lines and changes maybe once a week. [the full cost breakdown &rarr;](./docs/cost.md)

---

## tips

short, standalone techniques. each one is something you can use in your next session.

| tip | what you learn |
|-----|---------------|
| [prompt caching](./docs/tips/prompt-caching.md) | get 97%+ cache hit rates, slash your bill |
| [safety hooks](./docs/tips/safety-hooks.md) | block force pushes and rm -rf in 5 minutes |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | project vs global vs local settings |
| [session length](./docs/tips/session-length.md) | why shorter sessions are more efficient (with data) |
| [ultrathink](./docs/tips/ultrathink.md) | force extended thinking for complex problems |
| [context management](./docs/tips/context-management.md) | compaction strategies, active tool rate, keeping sessions tight |
| [plan mode](./docs/tips/plan-mode.md) | when planning saves time vs when it wastes it |
| [fast mode](./docs/tips/fast-mode.md) | same model, faster output, the tradeoff |
| [plugins](./docs/tips/plugins.md) | build a plugin from scratch, what makes one worth installing |
| [subagents](./docs/tips/subagents.md) | agent teams, worktree isolation, when parallel pays off |
| [mcp integration](./docs/tips/mcp-integration.md) | wire up MCP servers, use them inside sessions |
| [hooks v2](./docs/tips/hooks-v2.md) | command vs http vs prompt hooks, the async pattern |

---

## hooks

copy one, wire it up, done. each is a standalone bash script. [full guide &rarr;](./docs/hooks.md)

| hook | event | what it does |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | blocks force push, `rm -rf /`, DROP TABLE, curl-pipe-sh |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | blocks squash merges |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | logs every tool call to sqlite |
| [context-save](./hooks/context-save.sh) | PreCompact | saves context before compression |
| [notify](./hooks/notify.sh) | Notification | routes to macOS, Slack, ntfy |

<details>
<summary>4 more hooks</summary>

| hook | event | what it does |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | reminds you to commit after N edits |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | auto-updates "tested with" stamps |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | warns about gone tracking branches |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | auto-fixes markdown lint on save |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard blocking a dangerous command" />

## example agents

copy to `.claude/agents/` and invoke with `/agent <name>`. each teaches a different pattern. [guide &rarr;](./docs/agents.md)

| agent | pattern | what it does |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | watches files, runs tests, proposes fixes |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | tries risky changes in isolated worktrees |
| [arch-review](./examples/agents/arch-review.md) | quick review | fast architecture smell-test |
| [write-pr](./examples/agents/write-pr.md) | git integration | PR descriptions from your diff |

## commands i use

| command | what it does |
|---|---|
| `/lore` | usage data · costs, sessions, search, patterns |
| `/ship` | stage, commit, push, open PR in one command |
| `/improve` | propose CLAUDE.md updates from git history |

plus [2 example commands](./examples/commands/) you can copy: `/sweep`, `/quicktest`.

---

## my personal takes

| | what |
|---|---|
| [cost reality](./docs/cost.md) | what claude code actually costs, the prompt caching math |
| [mistakes i made](./docs/mistakes.md) | what burned me so you can skip it |
| [automation](./docs/automation.md) | patterns for safe daemons, cron, and github actions with claude code |
| [session workflow](./docs/session-workflow.md) | how i work day-to-day with claude code |
| [worktrees](./docs/worktrees.md) | parallel exploration with the desktop app |

## vs the alternatives

diplomatic, data-driven, no FUD. every claim cites a source.

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [pricing](./docs/comparisons/pricing.md)

---

## examples

- [CLAUDE.md templates](./examples/claude-md/) · starter configs for TypeScript, Python, Rust, Next.js
- [example agents](./examples/agents/) · 4 agents, each teaching a different pattern
- [example commands](./examples/commands/) · 2 commands you can copy to any project
- [handoff plugin](./examples/plugins/handoff/) · PreCompact context preservation
- [broadcast plugin](./examples/plugins/broadcast/) · async notifications on git events

---

## how this repo works

this repo runs on its own patterns.

- **CI workflows** for validation, freshness, competitive intel, community signal, releases, AI-assisted review
- **9 standalone hooks + per-plugin hooks** across cc / lore / time
- **AI-powered checks use haiku** so monthly CI cost stays under a couple of dollars
- **automation handles the mechanical work** so judgment-heavy decisions stay human

[automation philosophy &rarr;](./docs/automation.md)

---

## tools i built from these patterns

these all came out of living in claude code every day. each solves a specific problem i kept hitting.

- **[lore](./plugins/lore/)** · session mining to sqlite. costs, search, error memory, pattern detection
- **[claudemon](https://github.com/anipotts/claudemon)** · real-time session monitoring across projects and machines
- **[cc](./plugins/cc/)** · multi-session awareness. see what other sessions are doing, send messages between them
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · MCP server for read-only iMessage history. 26 tools, zero network requests

## more from me

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · long-form
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · newsletter
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · short-form

---

MIT &middot; built by [anipotts](https://anipotts.com)
