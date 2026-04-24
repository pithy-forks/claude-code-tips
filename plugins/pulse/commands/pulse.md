<!-- tested with: claude code v2.1.118 -->
---
description: Show current resource-meter state and draft handoffs before you hit the wall
argument-hint: "[handoff | quiet | loud | state]"
---

# /pulse: claude code proprioception

Three resource meters are burning right now:

- **5-hour session window**: Anthropic's per-window cap
- **7-day rolling weekly window**: Anthropic's secondary cap
- **Current conversation's 200k context**: this chat's buffer

This command surfaces them and helps you act on them.

## Dispatch on the argument

- **`state`** (or no argument): read `~/.claude/.pulse_cache` and report all three meters with human-readable reset times. If the cache is missing, explain that statusline hasn't run yet or this is an API-key session.

- **`handoff`**: draft a clean stopping point. Your job:
    1. Summarize what's in flight this session (active task, files touched, open questions) in 4-6 bullets.
    2. Propose the exact next-session opening prompt the user should paste into a fresh Claude Code window. It should reference specific file paths + line numbers and state the single next action.
    3. If there are uncommitted changes in the current repo, list them and ask the user whether to `git add -p` + commit them now (do NOT auto-commit).
    4. Suggest whether they should start the next session with Opus or Sonnet based on complexity.
    5. Write the whole handoff to `~/.claude/plans/pulse-handoff-$(date +%Y-%m-%d-%H%M).md` so it survives the session.

- **`quiet`**: `touch ~/.claude/.pulse_quiet` and confirm. Suppresses the awareness hook for all future sessions until the file is removed.

- **`loud`**: `rm -f ~/.claude/.pulse_quiet` and confirm.

## Why this exists

`/usage` shows the numbers once. `pulse` makes Claude *behave* differently as the meters fill: proactive triage at 80%, handoff suggestions at 90%, dramatic intervention at 95%. The awareness hook runs before every user turn and injects threshold-appropriate context. This command is the escape hatch when you want to check state directly or force a clean stopping point.
