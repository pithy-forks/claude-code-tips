<!-- tested with: claude code v2.1.118 -->
# claude-fuel

> Give Claude Code a fuel gauge for its three resource meters.

Claude Code burns through three caps simultaneously: the **5-hour session window**, the **7-day rolling weekly cap**, and the **current conversation's context**. `/usage` shows the numbers, but Claude itself has no notion of them. At 97% on a Friday afternoon, it keeps gamely starting new features instead of telling you to stop.

`fuel` fixes that. It taps the **only** programmatic surface Anthropic exposes (the statusline stdin JSON, documented at [code.claude.com/docs/en/statusline](https://code.claude.com/docs/en/statusline)) and injects threshold-aware context into every user turn via a `UserPromptSubmit` hook.

## What you get

| Max meter | Behavior |
|---|---|
| under 60% | silent |
| 60-80% | one compact meter line added to context |
| 80-90% | meter + proactive nudge to wrap WIP |
| 90-95% | meter + your personal p50 session length from `mine.db` |
| 95%+ | dramatic intervention + `/fuel handoff` suggestion |

Plus a `/fuel` slash command for direct inspection and clean handoffs.

## Install (requires Claude Code v2.1.80+)

Two steps.

### 1. Add the rate-limit capture to your statusline

`rate_limits` flows to the statusline stdin, but **not** to hook stdin. This is the documented Anthropic schema. So the statusline has to do the capture. Insert these lines into your existing `~/.claude/statusline-command.sh` (or wherever your statusline script lives), right after your existing `jq` field extractions:

```bash
# fuel capture
h5_pct=$(echo "$input"   | jq -r '.rate_limits.five_hour.used_percentage  // empty')
h5_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at        // empty')
w7_pct=$(echo "$input"   | jq -r '.rate_limits.seven_day.used_percentage  // empty')
w7_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at        // empty')
if [[ -n "$h5_pct" || -n "$w7_pct" ]]; then
    uc="$HOME/.claude/.fuel_cache"
    printf '{"ts":%d,"ctx_pct":%s,"h5_pct":%s,"h5_reset":%s,"w7_pct":%s,"w7_reset":%s,"model":"%s"}\n' \
        "$(date +%s)" "${used_pct:-null}" "${h5_pct:-null}" "${h5_reset:-null}" \
        "${w7_pct:-null}" "${w7_reset:-null}" "${model:-unknown}" \
        > "${uc}.tmp" 2>/dev/null && mv "${uc}.tmp" "$uc" 2>/dev/null
fi
```

This requires `$used_pct` and `$model` to already be extracted (as they are in most statuslines that show context percentage).

### 2. Enable the plugin

In `~/.claude/settings.json`:

```json
"enabledPlugins": {
  "fuel@cc": true
}
```

Start a new Claude Code session and send any prompt. Once a real model response has produced a `rate_limits` field, the cache populates and the hook starts gating output by threshold.

## Migration from v1.0.0 `pulse`

This plugin shipped briefly as `pulse` in early april 2026 and was renamed to `fuel` before the v2.1.0 marketplace release. If you had the old v1.0.0 `pulse` cache file, delete `~/.claude/.pulse_cache` (and `~/.claude/.pulse_quiet` if set) before first `/fuel` run:

```bash
rm -f ~/.claude/.pulse_cache ~/.claude/.pulse_quiet
```

Also update your statusline snippet: the cache path moved from `~/.claude/.pulse_cache` to `~/.claude/.fuel_cache` (see snippet above).

## Testing

```bash
# simulate a 94% five_hour state
cat > ~/.claude/.fuel_cache <<EOF
{"ts":$(date +%s),"ctx_pct":31,"h5_pct":94.2,"h5_reset":$(( $(date +%s) + 1000 )),"w7_pct":72.1,"w7_reset":$(( $(date +%s) + 86400 )),"model":"claude-opus-4-7"}
EOF

# run the hook manually
python3 "${CLAUDE_PLUGIN_ROOT}/hooks/awareness.py" < /dev/null
```

You should see the warn-tier output. Lower the percentages to <60 and confirm it goes silent.

## Env vars

- `FUEL_DRAMATIC=1`: enables the dramatic flavor text at 95%+
- `FUEL_DEBUG=1`: verbose stderr logging
- `touch ~/.claude/.fuel_quiet`: suppresses the hook for all sessions

## Why this architecture

Primary-source verified (April 2026):

- **`UserPromptSubmit` hook stdin** contains: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `prompt`. **No `rate_limits`.** ([hooks reference](https://code.claude.com/docs/en/hooks))
- **Statusline stdin** contains `rate_limits.five_hour` and `rate_limits.seven_day`, each with `used_percentage` and `resets_at`. Absent for API-key sessions. ([statusline reference](https://code.claude.com/docs/en/statusline))
- **`UserPromptSubmit` stdout** is added to Claude's context as additionalContext. ([hooks guide](https://code.claude.com/docs/en/hooks-guide))

So: statusline writes cache, hook reads cache, stdout injects awareness. No scraping, no reverse engineering.

## Related

- [`mine`](https://github.com/anipotts/claude-code-tips): mines every session into SQLite. `fuel` queries `mine.db` at 90%+ for personalized baselines.

## License

MIT, Ani Potts
