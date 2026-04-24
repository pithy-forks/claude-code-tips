> [EN](./README.md) | [ZH](./README.zh-CN.md) | [ES](./README.es.md) | [HI](./README.hi.md) | [PT](./README.pt-BR.md) | [JA](./README.ja.md)

# claude-code-tips

[![CI](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml/badge.svg)](https://github.com/anipotts/claude-code-tips/actions/workflows/validate.yml)
[![GitHub तारे](https://img.shields.io/github/stars/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/stargazers)
[![last commit](https://img.shields.io/github/last-commit/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](https://github.com/anipotts/claude-code-tips/commits/main)
[![tested with](https://img.shields.io/badge/tested%20with-Claude%20Code%20v2.1.94-000?style=flat-square&labelColor=D4A574&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![license](https://img.shields.io/github/license/anipotts/claude-code-tips?style=flat-square&labelColor=111827&color=000)](./LICENSE)

Claude Code के पैटर्न, YC startups, public tech companies, और unicorns में battle-tested। किसी ने maintain किया जो Claude Code को अपने काम के रूप में use करता है।

यहाँ नए हो? [tips index](./docs/tips/) से शुरू करें या [hooks](./docs/hooks.md) और [automation](./docs/automation.md) को skim करें।

## क्या है यहाँ

तीन plugins, एक marketplace।

- **`mine@cc`** हर session को sqlite में mine किया जाता है। costs, tools, errors, hotspots, loops को query करें, और अपने पूरे history में full-text search करें। सब कुछ local है।
- **`cc@cc`** cross-session awareness और messaging। plus एक `time` subsystem: `/cc:time-estimate` realistic Claude Code time देता है जो आपके session history पर आधारित है, optimistic guesses नहीं।
- **`fuel@cc`** 3-meter fuel gauge (5-hour session, 7-day weekly, 200k context)। pre-turn hook Claude को cleaner handoffs की ओर nudge करता है जब meters भरते हैं। `/fuel state` उन्हें directly पढ़ता है; `/fuel handoff` एक stopping point draft करता है।

```
> /cc:time-estimate "rewrite auth middleware and add tests"
CC: ~22 min active (standard mode, Opus 4.7 high)
आपका समय: ~15 min review
```

## quick start

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (one time)
/plugin install mine@cc                             # install mine (session analytics)
/plugin install cc@cc                               # install cc (cross-session messaging)
```

फिर: [safety-guard.sh](./hooks/safety-guard.sh) को copy करें dangerous commands को block करने के लिए। एक [tip](./docs/tips/) पढ़ें। बस।

---

## संख्याएं

दर्जनों projects में सैकड़ों sessions। $200/mo max plan।

same usage API पर ~$12K की cost होगी caching के साथ, ~$95K बिना। कोई autonomous loops नहीं। कोई cron jobs नहीं। हर session मेरे द्वारा prompt type करने से शुरू होता है। [cost math कैसे काम करता है &rarr;](./docs/cost.md)

<img src="./gifs/mine-stats.gif" width="100%" alt="mine stats showing sessions, tokens, costs, and projects" />

---

## mine plugin install करें

```bash
/plugin marketplace add anipotts/claude-code-tips   # add marketplace (one time)
/plugin install mine@cc                             # install mine (session analytics)
/plugin install cc@cc                               # install cc (cross-session messaging)
```

आप **[mine](./plugins/mine/)** प्राप्त करते हैं · session mining को sqlite में। costs, search, error memory, pattern detection। सभी डेटा `~/.claude/mine.db` पर local रहता है।

```
/mine                     आज के sessions, cost, top tools
/mine search "websocket"  सभी conversations में full-text search
/mine mistakes            error patterns जो Claude दोहराता है
/mine hotspots            sessions में सबसे ज्यादा edited files
/mine loops               sessions में repeated patterns
```

`mine` + `safety-guard` hook के साथ शुरू करें। जैसे जाएँ और भी जोड़ें। **[mine docs &rarr;](./plugins/mine/)**

---

## cc plugin

cross-session messaging और `time` subsystem। देखें कि दूसरे Claude Code sessions क्या कर रहे हैं, उनके बीच messages भेजें, और अपने session history के आधार पर realistic time estimates प्राप्त करें।

```bash
/plugin install cc@cc
```

```
/cc                             active sessions दिखाएँ
/cc send merizo "pause"         दूसरे session को message भेजें
/cc:time-estimate <task>        ranged CC estimate, आपके current model + effort का उपयोग करता है
/cc:time-calibrate              real throughput (mine.db से) को rule के विरुद्ध diff करें
/cc:time-benchmark              guided A/B/C आपके model पर effort levels में
```

---

## 3 चीजें जिन्होंने मेरे coding को बदल दिया

### hooks

hooks "Claude does what i want" और "Claude does whatever it feels like" के बीच का अंतर हैं। CLAUDE.md guidance देता है। hooks enforcement देते हैं। एक सुझाव है, दूसरा एक दीवार है।

इस repo में 9 hooks हैं जिन्हें आप किसी भी project में drop कर सकते हैं। safety-guard force pushes, `rm -rf /`, और `curl | bash` को block करता है। no-squash squash merges को block करता है। context-save compaction से पहले state preserve करता है। जो आपके workflow के लिए fit करते हैं उन्हें चुनें। [hook guide &rarr;](./docs/hooks.md)

### agent teams

multiple Claude instances एक ही codebase पर simultaneously काम करते हैं, प्रत्येक अपने स्वयं के git worktree में। coordinator tasks assign करता है, results collect करता है, सर्वश्रेष्ठ approach को merge करता है।

मैं इसका उपयोग parallel research के लिए करता हूँ, risky changes को safely try करने के लिए, और अपने working tree को touch किए बिना approaches को side-by-side compare करने के लिए। [how i use agent teams &rarr;](./docs/agents.md)

### prompt caching

यह कारण है कि $200/mo plan AI coding में सर्वश्रेष्ठ deal है। Claude Code आपके system prompt, tools, और CLAUDE.md को prefix के रूप में cache करता है। मेरे 91% input tokens cache को hit करते हैं, यानी मैं अपने 91% reads पर input cost का 10% pay करता हूँ।

चाबी: अपना CLAUDE.md short और stable रखें। हर edit prefix cache को break करता है। मेरा 30 lines का है और शायद हफ्ते में एक बार बदलता है। [the full cost breakdown &rarr;](./docs/cost.md)

---

## सुझाव

छोटी, standalone techniques। हर एक कुछ है जो आप अपने अगले session में उपयोग कर सकते हैं।

| सुझाव | आप क्या सीखते हैं |
|-----|---------------|
| [prompt caching](./docs/tips/prompt-caching.md) | 97%+ cache hit rates प्राप्त करें, अपने बिल को slash करें |
| [safety hooks](./docs/tips/safety-hooks.md) | 5 मिनट में force pushes और rm -rf को block करें |
| [settings hierarchy](./docs/tips/settings-hierarchy.md) | project vs global vs local settings |
| [session length](./docs/tips/session-length.md) | क्यों shorter sessions ज्यादा efficient हैं (data के साथ) |
| [ultrathink](./docs/tips/ultrathink.md) | complex problems के लिए extended thinking force करें |
| [context management](./docs/tips/context-management.md) | compaction strategies, active tool rate, sessions को tight रखना |
| [plan mode](./docs/tips/plan-mode.md) | कब planning समय बचाता है vs कब यह waste करता है |
| [fast mode](./docs/tips/fast-mode.md) | same model, faster output, tradeoff |
| [plugins](./docs/tips/plugins.md) | scratch से plugin build करें, क्या एक को install करने लायक बनाता है |
| [subagents](./docs/tips/subagents.md) | agent teams, worktree isolation, कब parallel pay off होता है |
| [mcp integration](./docs/tips/mcp-integration.md) | MCP servers को wire up करें, sessions के अंदर उन्हें use करें |
| [hooks v2](./docs/tips/hooks-v2.md) | command vs http vs prompt hooks, async pattern |

---

## hooks

एक copy करें, इसे wire up करें, बस। हर एक standalone bash script है। [full guide &rarr;](./docs/hooks.md)

| hook | event | यह क्या करता है |
|---|---|---|
| [safety-guard](./hooks/safety-guard.sh) | PreToolUse | force push, `rm -rf /`, DROP TABLE, curl-pipe-sh को block करता है |
| [no-squash](./hooks/no-squash.sh) | PreToolUse | squash merges को block करता है |
| [panopticon](./hooks/panopticon.sh) | PostToolUse | हर tool call को sqlite में log करता है |
| [context-save](./hooks/context-save.sh) | PreCompact | compression से पहले context save करता है |
| [notify](./hooks/notify.sh) | Notification | macOS, Slack, ntfy को route करता है |

<details>
<summary>4 और hooks</summary>

| hook | event | यह क्या करता है |
|---|---|---|
| [commit-nudge](./hooks/commit-nudge.sh) | PostToolUse | N edits के बाद commit करने के लिए याद दिलाता है |
| [version-stamp](./hooks/version-stamp.sh) | SessionEnd | auto-updates "tested with" stamps |
| [stale-branch](./hooks/stale-branch.sh) | SessionStart | gone tracking branches के बारे में warn करता है |
| [md-lint-fix](./hooks/md-lint-fix.sh) | PostToolUse | save पर auto-fixes markdown lint |

</details>

<img src="./gifs/hook-safety.gif" width="100%" alt="safety-guard blocking a dangerous command" />

## example agents

`.claude/agents/` को copy करें और `/agent <name>` के साथ invoke करें। हर एक अलग pattern सिखाता है। [guide &rarr;](./docs/agents.md)

| agent | pattern | यह क्या करता है |
|---|---|---|
| [watch-tests](./examples/agents/watch-tests.md) | daemon | files को watch करता है, tests चलाता है, fixes propose करता है |
| [try-worktree](./examples/agents/try-worktree.md) | worktree | isolated worktrees में risky changes try करता है |
| [arch-review](./examples/agents/arch-review.md) | quick review | fast architecture smell-test |
| [write-pr](./examples/agents/write-pr.md) | git integration | आपके diff से PR descriptions |

## commands जो मैं use करता हूँ

| command | यह क्या करता है |
|---|---|
| `/mine` | usage data · costs, sessions, search, patterns |
| `/ship` | stage, commit, push, एक command में PR खोलें |
| `/improve` | git history से CLAUDE.md updates propose करें |

plus [2 example commands](./examples/commands/) जिन्हें आप copy कर सकते हैं: `/sweep`, `/quicktest`।

---

## मेरे personal takes

| | क्या |
|---|---|
| [cost reality](./docs/cost.md) | Claude Code actually cost क्या है, prompt caching math |
| [mistakes i made](./docs/mistakes.md) | जो मुझे जला ताकि आप इसे skip कर सकें |
| [automation](./docs/automation.md) | 12 CI pipelines जो इस repo को maintain करती हैं |
| [session workflow](./docs/session-workflow.md) | मैं दिन-प्रतिदिन Claude Code के साथ कैसे काम करता हूँ |
| [worktrees](./docs/worktrees.md) | desktop app के साथ parallel exploration |

## vs alternatives

diplomatic, data-driven, कोई FUD नहीं। हर claim एक source cite करता है।

[vs cursor](./docs/comparisons/cursor.md) &middot; [vs codex](./docs/comparisons/codex.md) &middot; [vs gemini](./docs/comparisons/gemini.md) &middot; [vs antigravity](./docs/comparisons/antigravity.md) &middot; [pricing](./docs/comparisons/pricing.md)

---

## examples

- [CLAUDE.md templates](./examples/claude-md/) · TypeScript, Python, Rust, Next.js के लिए starter configs
- [example agents](./examples/agents/) · 4 agents, हर एक अलग pattern सिखाता है
- [example commands](./examples/commands/) · 2 commands जो आप किसी भी project को copy कर सकते हैं
- [handoff plugin](./examples/plugins/handoff/) · PreCompact context preservation
- [broadcast plugin](./examples/plugins/broadcast/) · git events पर async notifications

---

## यह repo कैसे काम करता है

यह repo अपने स्वयं के patterns पर चलता है।

- **12 CI workflows** · docs audit, competitive intel, community digest, freshness check, stale cleanup, dependabot, releases, plugin smoke test, PR quality gate, validation, Claude responder, upstream watcher
- **11 hooks** हर session पर चलते हैं
- **<$1/month** CI cost · AI-powered workflows haiku का उपयोग करते हैं
- **0 manual maintenance** · सब कुछ जिसके लिए taste की requirement नहीं है automated है

[automation details &rarr;](./docs/automation.md)

---

## tools जो मैंने इन patterns से build किए

ये सभी हर दिन Claude Code में रहने से आए। हर एक एक specific problem को solve करता है जो मैं बार-बार hit करता था।

- **[mine](./plugins/mine/)** · session mining को sqlite में। costs, search, error memory, pattern detection
- **[claudemon](https://github.com/anipotts/claudemon)** · real-time session monitoring projects और machines में
- **[cc](./plugins/cc/)** · multi-session awareness। देखें कि दूसरे sessions क्या कर रहे हैं, उनके बीच messages भेजें
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · iMessage history के लिए MCP server। 26 tools, zero network requests

## मुझसे और

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · long-form
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · newsletter
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · short-form

---

MIT &middot; built by [anipotts](https://anipotts.com)

<!-- translated from README.md @ 925abe7 -->
