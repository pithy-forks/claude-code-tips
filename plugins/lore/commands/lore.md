---
description: query your accumulated claude code lore - sessions, costs, search, patterns
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
  - CronCreate
  - CronDelete
  - CronList
---
<!-- tested with: claude code v2.1.122 -->

Read the skill file at `${CLAUDE_PLUGIN_ROOT}/skills/query/SKILL.md` and follow its instructions completely to handle this `/lore` request. The user's intent comes from whatever they typed after `/lore`.
