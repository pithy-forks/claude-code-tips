> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub stars](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.122-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

claude code के पैटर्न, जो YC startups, public tech companies और unicorns में battle-tested हैं। किसी के द्वारा maintain किया जाता है जो claude code को अपनी job के तौर पर use करते हैं।

नए हो? [tips index](./docs/tips/) से शुरू करो या [hooks](./docs/hooks.md) और [automation](./docs/automation.md) को skim करो।

## क्या अंदर है

तीन plugins, एक marketplace।

- **`lore@anipotts`** हर session को sqlite में मined किया जाता है। costs, tools, errors, hotspots, loops और अपने पूरे history के across full-text search को query करो। सब कुछ local है।
- **`cc@anipotts`** cross-session awareness और messaging। साथ ही एक `time` subsystem: `/cc:time-estimate` realistic claude-code time देता है जो तुम्हारे session history में grounded होता है, optimistic guesses नहीं।
- **`time@anipotts`** 3-meter fuel gauge (5-hour session, 7-day weekly, 200k context)। pre-turn hook claude को cleaner handoffs की ओर nudge करता है जबकि meters भरते हैं। `/fuel state` उन्हें directly पढ़ता है; `/fuel handoff` एक stopping point को draft करता है।

```
> /cc:time-estimate "rewrite auth middleware and add tests"
CC: ~22 min active (standard mode, Opus 4.7 high)
your time: ~15 min review
```

## जल्दी शुरुआत

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (एक बार)
/plugin install lore@anipotts                             # install lore (session analytics)
/plugin install cc@anipotts                               # install cc (cross-session messaging)
```

फिर: [safety-guard.sh](./hooks/safety-guard.sh) को copy करो खतरनाक commands को block करने के लिए। एक [tip](./docs/tips/) पढ़ो। हो गया।

---

## संख्याएं

दर्जनों projects के across सैकड़ों sessions। $200/mo max plan।

same usage $12K के करीब API पर caching के साथ खर्च होगी, बिना caching के $95K। कोई autonomous loops नहीं। कोई cron jobs नहीं। हर session मेरे द्वारा एक prompt type करके शुरू होता है। [cost math कैसे काम करता है &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine stats showing sessions, tokens, costs, and projects" />

---

## lore plugin install करो

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (एक बार)
/plugin install lore@anipotts                             # install lore (session analytics)
/plugin install cc@anipotts                               # install cc (cross-session messaging)
```

तुम्हें **[lore](./plugins/lore/)** मिलता है · session mining to sqlite। costs, search, error memory, pattern detection। सभी data locally `~/.claude/lore/lore.db` में रहता है।

```
/lore                     today's sessions, cost, top tools
/lore search "websocket"  full-text search across all conversations
/lore mistakes            error patterns claude keeps repeating
/lore hotspots            most-edited files across sessions
/lore loops               repeated patterns across sessions
```

`lore` + `safety-guard` hook से शुरू करो। जाओ तो और जोड़ो। **[lore docs &rarr;](./plugins/lore/)**

---

## cc plugin

cross-session messaging और `time` subsystem। देखो कि अन्य claude code sessions क्या कर रहे हैं, उनके बीच messages भेजो, और realistic time estimates प्राप्त करो जो तुम्हारे अपने session history में grounded हों।

```bash
/plugin install cc@anipotts
```

```
/cc                             show active sessions
/cc send merizo "pause"         message another session
/cc:time-estimate <task>        ranged CC estimate, uses your current model + effort
/cc:time-calibrate              diff real throughput (from lore.db) against the rule
/cc:time-benchmark              guided A/B/C across effort levels on your model
```

---

## 3 चीजें जिन्होंने बदल दिया कि मैं कैसे code करता हूं

### hooks

hooks का अंतर "claude वह करता है जो मैं चाहता हूं" और "claude वह करता है जो उसे चाहता है" के बीच है। CLAUDE.md guidance देता है। hooks enforcement देते हैं। एक suggestion है, दूसरा एक wall है।

इस repo के पास 9 hooks हैं जो तुम किसी भी project में drop कर सकते हो। safety-guard force pushes, `rm -rf /`, और `curl | bash` को block करता है। no-squash squash merges को block करता है। context-save compaction से पहले state को preserve करता है। वह चुनो जो तुम्हारे workflow में fit हो। [hook guide &rarr;](./docs/hooks.md)

### agent teams

multiple claude instances एक ही codebase पर simultaneously काम कर रहे हैं, प्रत्येक अपनी अलग git worktree में। coordinator tasks assign करता है, results collect करता है, best approach को merge करता है।

मैं इसे parallel research के लिए, risky changes को safely आजमाने के लिए, और अपनी working tree को touch किए बिना approaches को side-by-side compare करने के लिए use करता हूं। [मैं agent teams कैसे use करता हूं &rarr;](./docs/agents.md)

### prompt caching

यही कारण है कि $200/mo plan AI coding में best deal है। claude code तुम्हारे system prompt, tools, और CLAUDE.md को एक prefix के रूप में cache करता है। मेरे 91% input tokens cache hit करते हैं, मतलब मैं 91% reads पर input cost का 10% pay करता हूं।

key: अपने CLAUDE.md को short और stable रखो। हर edit prefix cache को break करता है। मेरा 30 lines का है और शायद हफ्ते में एक बार change होता है। [पूरा cost breakdown &rarr;](./docs/cost.md)

---

## टिप्स

short, standalone techniques। हर एक कुछ ऐसा है जो तुम अपने अगले session में use कर सकते हो।

| tip | तुम क्या सीखते हो |
|-----|---------------|
| [prompt caching](./docs/tips/prompt-caching.md) | 97%+ cache hit rates प्राप्त करो, अपना bill slash करो |
| [safety hooks](./docs/tips/safety-hooks.md) | 5 minutes में force pushes और rm -rf को block करो |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | project vs global vs local settings |
| [session length](./docs/tips/session-length.md) | क्यों छोटे sessions ज्यादा efficient हैं (data के साथ) |
| [ultrathink](./docs/tips/ultrathink.md) | complex problems के लिए extended thinking को force करो |
| [context management](./docs/tips/context-management.md) | compaction strategies, active tool rate, sessions को tight रखना |
| [plan mode](./docs/tips/plan-mode.md) | कब planning time बचाता है बनाम कब waste करता है |
| [fast mode](./docs/tips/fast-mode.md) | same model, faster output, tradeoff |
| [plugins](./docs/tips/plugins.md) | scratch से एक plugin build करो, कौन सा एक install करने लायक है |
| [subagents](./docs/tips/subagents.md) | agent teams, worktree isolation, कब parallel pay off करता है |
| [mcp integration](./docs/tips/mcp-integration.md) | MCP servers को wire करो, उन्हें sessions के अंदर use करो |
| [hooks v2](./docs/tips/hooks-v2.md) | command vs http vs prompt hooks, async pattern |

---

## hooks

एक copy करो, wire करो, हो गया। प्रत्येक एक standalone bash script है। [full guide &rarr;](./docs/hooks.md)

| hook | event | क्या यह करता है |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | force push, `rm -rf /`, DROP TABLE, curl-pipe-sh को block करता है |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | squash merges को block करता है |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | हर tool call को sqlite में log करता है |
| [context-save](./hooks/context-save.sh) | PreCompact | compression से पहले context को save करता है |
| [notify](./hooks/notify.sh) | Notification | macOS, Slack, ntfy में routes करता है |

<details>
<summary>4 और hooks</summary>

| hook | event | क्या यह करता है |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | N edits के बाद commit करने की याद दिलाता है |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | "tested with" stamps को auto-update करता है |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | gone tracking branches के बारे में warn करता है |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | save पर markdown lint को auto-fix करता है |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard blocking a dangerous command" />

## उदाहरण agents

`.claude/agents/` में copy करो और `/agent <name>` के साथ invoke करो। प्रत्येक एक different pattern सिखाता है। [guide &rarr;](./docs/agents.md)

| agent | pattern | क्या यह करता है |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | files को watch करता है, tests चलाता है, fixes propose करता है |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | isolated worktrees में risky changes try करता है |
| [arch-review](./examples/agents/arch-review.md) | quick review | fast architecture smell-test |
| [write-pr](./examples/agents/write-pr.md) | git integration | तुम्हारे diff से PR descriptions |

## commands जो मैं use करता हूं

| command | क्या यह करता है |
|---|---|
| `/lore` | usage data · costs, sessions, search, patterns |
| `/ship` | stage, commit, push, एक command में PR खोलो |
| `/improve` | git history से CLAUDE.md updates propose करो |

साथ ही [2 example commands](./examples/commands/) जो तुम copy कर सकते हो: `/sweep`, `/quicktest`।

---

## मेरे व्यक्तिगत विचार

| | क्या |
|---|---|
| [cost reality](./docs/cost.md) | claude code actually क्या खर्च करता है, prompt caching math |
| [mistakes मैंने किए](./docs/mistakes.md) | क्या मुझे जला दिया ताकि तुम skip कर सको |
| [automation](./docs/automation.md) | 12 CI pipelines जो इस repo को maintain करती हैं |
| [session workflow](./docs/session-workflow.md) | मैं दिन-प्रतिदिन claude code के साथ कैसे काम करता हूं |
| [worktrees](./docs/worktrees.md) | desktop app के साथ parallel exploration |

## alternatives के मुकाबले

diplomatic, data-driven, कोई FUD नहीं। हर claim एक source cite करता है।

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [pricing](./docs/comparisons/pricing.md)

---

## उदाहरण

- [CLAUDE.md templates](./examples/claude-md/) · TypeScript, Python, Rust, Next.js के लिए starter configs
- [example agents](./examples/agents/) · 4 agents, प्रत्येक एक different pattern सिखाता है
- [example commands](./examples/commands/) · 2 commands जो तुम किसी भी project में copy कर सकते हो
- [handoff plugin](./examples/plugins/handoff/) · PreCompact context preservation
- [broadcast plugin](./examples/plugins/broadcast/) · git events पर async notifications

---

## यह repo कैसे काम करता है

यह repo अपने पैटर्न पर चलता है।

- **12 CI workflows** · docs audit, competitive intel, community digest, freshness check, stale cleanup, dependabot, releases, plugin smoke test, PR quality gate, validation, claude responder, upstream watcher
- **11 hooks** हर session पर चलते हैं
- **<$1/month** CI cost · AI-powered workflows haiku use करते हैं
- **0 manual maintenance** · सब कुछ जिसे taste की जरूरत नहीं automated है

[automation details &rarr;](./docs/automation.md)

---

## tools जो मैंने इन patterns से build किए

ये सब इस बात से आते हैं कि हर दिन claude code में रहना। प्रत्येक एक specific problem को solve करता है जिससे मैं बार-बार hit होता था।

- **[lore](./plugins/lore/)** · session mining to sqlite। costs, search, error memory, pattern detection
- **[claudemon](https://github.com/anipotts/claudemon)** · real-time session monitoring projects और machines के across
- **[cc](./plugins/cc/)** · multi-session awareness। देखो कि अन्य sessions क्या कर रहे हैं, उनके बीच messages भेजो
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · MCP server read-only iMessage history के लिए। 26 tools, zero network requests

## मेरे से और

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · long-form
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · newsletter
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · short-form

---

MIT · built by [anipotts](https://anipotts.com)

<!-- translated from README.md @ 62df0ee -->
