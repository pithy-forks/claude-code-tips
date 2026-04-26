<!-- tested with: claude code v2.1.118 -->

## Think in Claude Code time, not human time

When planning, estimating, or communicating timelines in Claude Code sessions, frame in CC active time (what Claude actually does), not wall time (what you see, dominated by human-review idle). All implementation is done by Claude Code.

**Last calibrated:** 2026-04-22 against April 2026 official docs + empirical session data. Quarterly re-calibration recommended. Use `/time-calibrate` to re-measure against your own `lore.db`.

### The only two numbers

1. **CC time (active):** seconds Claude is running tool calls + adaptive thinking.
2. **Your time:** reviewing, deciding, approving.

Your time is ALWAYS the bottleneck. Coding throughput is not the constraint. Every estimate must distinguish these.

### Session modes (bimodal, not a single average)

Real-world sessions cluster around three shapes. Pick the shape first, then estimate.

| Mode | Wall | Active (CC) | Typical content |
|---|---|---|---|
| **Quick fix** | 2-10 min | 1-5 min | single-file edit, typo, one-line bug, config tweak |
| **Standard** | 20-60 min | 10-25 min | feature work, refactor, small module, bug investigation |
| **Marathon** | 1-3 hr | 30-75 min | migration, infra build, multi-file refactor |

Rough distribution of real sessions: 20% quick, 50% standard, 30% marathon. Sessions left running 12+ hours are abandoned terminal tabs, not actual work; exclude them from any mental model.

### Baseline throughput

On Opus 4.6 at `effortLevel: low`, Claude issues **~3.0 tool calls per active minute**. This is the empirical baseline for all multipliers below. Short sessions (<5 min active) run faster (~6 calls/min) because tasks are simpler and need less inter-tool reasoning.

Claude does not slow down in long sessions. The human reviewer does. Wall-time tool rate drops 3-5× from short sessions to long ones; that delta is almost entirely human idle.

### Model × effort throughput matrix

Relative to the Opus 4.6 `low` baseline (1.0× = ~3.0 calls/active min). Bold values are measured empirically. Non-bold are directional estimates extrapolated from adaptive-thinking proxies. Anthropic does not publish official per-effort throughput; re-measure your own with `/time-calibrate` (requires the `lore` plugin installed).

| Model | low | medium | high | xhigh | max | Context |
|---|---|---|---|---|---|---|
| Opus 4.7 | **0.87×** | ~0.70× | ~0.55× | ~0.40× (default) | ~0.25× | 1M |
| Opus 4.6 | **1.00×** | ~0.80× | ~0.60× | (falls back to high) | ~0.35× | 1M |
| Sonnet 4.6 | **0.85×** | ~0.70× | ~0.55× | (falls back to high) | ~0.30× | 1M |
| Haiku 4.5 | ~1.6× (no effort lever) | n/a | n/a | n/a | n/a | 200K |

**Fallback behavior (official):** requesting an unsupported effort level silently falls back to the highest supported level at or below. `xhigh` on Opus 4.6 becomes `high`.

**Haiku 4.5 has no effort lever** because it doesn't support adaptive thinking. It runs fast and flat regardless.

**Per-turn thinking swells with effort.** Even at the same effort, Opus 4.7 thinks ~2.7× more per tool call than Opus 4.6 (empirical on `low`), reflecting its heavier adaptive-thinking default. `xhigh` and `max` dedicate increasingly long thinking phases before each tool call; that is the mechanism by which throughput drops.

### Effort level semantics (per Anthropic docs, April 2026)

- **low:** short, scoped tasks; latency-sensitive; pairs well with explicit checklists.
- **medium:** drop-in for most workflows; reduces cost while keeping quality.
- **high:** balance of intelligence and token consumption; "often the sweet spot."
- **xhigh (Opus 4.7 only):** recommended default for coding and agentic work; meaningfully more tokens than high.
- **max:** reserve for frontier problems; can overthink on structured output.

### Setting effort (precedence, highest to lowest)

1. `CLAUDE_CODE_EFFORT_LEVEL` environment variable.
2. `--effort <level>` CLI flag (session-scoped).
3. `/effort <level>` or `/effort auto` interactive (session-scoped).
4. `effortLevel` key in settings.json (local project > shared project > user).
5. Model default.

Mid-session `/effort` change takes effect next turn. Effort persists per session; `max` does not survive `--resume` unless set via env var.

**Resolve, don't guess.** When producing an estimate, read the actual active effort (env → flag → session → settings → default). Cite the precedence rung that supplied the value. See `/time-estimate` for the canonical resolution path.

### Three tiers of parallelism (distinct architectures)

| Tier | Mechanism | Throughput impact | Token cost | Context |
|---|---|---|---|---|
| **Main agent** | Your session. A single turn can fire multiple independent tool calls. | 1× baseline | 1× | Full (1M or 200K) |
| **Subagent** | Task tool. Isolated context window, returns summary only to parent. | 1.8-2.2× when task decomposes cleanly into 3-5 streams | ~1× per subagent | Fresh; inherits nothing |
| **Agent teammate** | Experimental agent-teams. Separate CC sessions with peer messaging. | 3-5× ceiling for parallel research / competing-hypothesis review | 3-5× (linear in N teammates) | Own full context per teammate |

Agent teams require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and v2.1.32+. Teammates cannot spawn their own teams. Use for 3-5-member research or review, not for solo coding.

### Subagent effort inheritance

- Built-in Plan and general-purpose subagents: inherit the main session's effort level.
- Built-in Explore subagent: hardwired to Haiku (no effort lever applies).
- Custom subagents: can override with `effort: <level>` in YAML frontmatter.

If a custom subagent sets `model: haiku`, the effort setting is ignored regardless of what the parent session had.

### When sessions break down (1M-context era)

With 1M context on Opus 4.7/4.6/Sonnet 4.6 and ~95% autocompact threshold (override via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`), 2025-era compaction panic is obsolete. Typical empirical rates:

| Session length | Compaction rate | Takeaway |
|---|---|---|
| <30 min | 0-2% | Clean. |
| 30-60 min | 20-25% | Sweet spot. |
| 60-90 min | 25-30% | Fine on 1M models. |
| 90-120 min | ~30% | Watch for drift. |
| 2 hr+ | ~32% | Diminishing returns, not catastrophic. |

**Keep focused sessions under ~90 min for human cognitive reasons, not for Claude's context limits.** Split a multi-hour task across sessions for your benefit, not Claude's.

### Cost framing (plan-aware)

- **Max / Team Premium ($200/mo flat):** $0 incremental per session. Session length does not affect cost.
- **Pro / API pay-per-use:** roughly $3-25/session depending on model + effort + length. `max` effort can 3-5× this. Fast mode doubles per-token cost for 2.5× speed.
- **Cache hit rate in practice:** 95-97% of input tokens are cache reads on typical work. Caching matters for latency and rate limits, not dollars on flat plans.
- **Fast mode (Opus 4.6 only, research preview):** 2.5× throughput at `$30/$150 per MTok`. NOT available on Opus 4.7 or Sonnet 4.6. Toggle with `/fast` or `CLAUDE_CODE_DISABLE_FAST_MODE=1`.
- **Agent teammates:** N-member team ≈ N× token spend. On flat plans, still $0 incremental. On API, multiplicative.

### Estimation format

Format all CC estimates as ``CC: <range>`` with ~~human equivalent~~ strikethrough when the contrast is dramatic.

Examples:
- "Quick fix: **`CC: 2-5 min`** | trivial review"
- "Standard feature: **`CC: 1 session (~15-20 min active)`** ~~1-2 days human~~ | your time: ~15 min review"
- "Full migration: **`CC: 6-8 sessions`** ~~multi-week sprint~~ | your time: ~2 hrs review across 2 days"
- "Parallel research: **`CC: ~15 min wall`** (~30 min subagent work condensed by ~2× parallelism)"
- "At `high` effort on Opus 4.7: **`CC: ~25 min`** (baseline 15 min at `low`, +67% for adaptive thinking)"

### Rules for quoting estimates

- Always quote CC active time, not wall time.
- Always mention "your time" on multi-phase plans.
- Always resolve and cite the active effort level before quoting numbers. Don't assume.
- If using subagents: "N subagents concurrently ≈ ~2× throughput multiplier."
- If using agent team: "N-member team: Nx throughput ceiling, Nx token spend."
- If on Opus 4.7 with ambitious work, offer the effort trade: "`xhigh` (default) is ~30% slower than `high`. Drop to `high` for throughput-bound tasks, keep `xhigh` for architecture."
- Never suggest `/fast` on Opus 4.7 or Sonnet 4.6. Fast mode is Opus 4.6 only.
- Never assume effort is `low` without checking. Run `/effort` if unsure.

### Confidence levels

- **High:** well-scoped, similar to prior work, clear requirements.
- **Medium:** some ambiguity, mid-session decisions likely.
- **Low:** unclear requirements, unfamiliar codebase, integration-heavy.

Example: "**`CC: 2-3 sessions`** (medium confidence; depends on API compatibility)"

### What to never do

- Never frame implementation timelines in human-developer units (days/weeks/sprints) for coding work.
- Never treat coding throughput as the bottleneck. It's always review, decisions, or ambiguous requirements.
- Never sandbag. Be ambitious about what a session can accomplish, honest about validation overhead.
- Never give a single number without distinguishing CC time from your time.
- Never quote throughput without noting the (model, effort) pair assumed.
- Never conflate subagents with agent teammates. Different tiers, different costs.
- Never suggest fast mode on Opus 4.7 or Sonnet 4.6. Opus 4.6 only.
- Never recommend "keep sessions under an hour." 1M context makes 90-120 min fine for focused work.
- Never use the old $12/session API value. Framing depends on the user's plan.

### Re-calibrate your own numbers

The matrix above is a generic starting point. Your actual throughput depends on your effort setting, the tasks you do, and your model mix. To re-measure:

1. Run `/time-calibrate` (needs the `lore` plugin installed, which builds `~/.claude/lore.db` from session logs).
2. Review the diff report against the matrix above.
3. If any cell drifts >15% from the matrix, trust your own measurement and keep a personal note next to this rule.
4. Quarterly re-calibration is a good default cadence.
