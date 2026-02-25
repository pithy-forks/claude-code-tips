# session-analytics

Track your Claude Code usage patterns. Session duration, time-of-day distribution, project frequency -- all stored locally for your own analysis.

## What it tracks

On every `SessionStart` and `SessionEnd` event, this plugin records:

- **Session ID** -- unique identifier for the session
- **Event type** -- start or end
- **Timestamp** -- when it happened
- **Project directory** -- which project you were working in
- **Duration** -- calculated from start/end pairs

Data is appended to `~/.claude/session-analytics.jsonl` as newline-delimited JSON.

## Sample data

```jsonl
{"event":"start","session_id":"ses-abc123","timestamp":"2026-02-25T09:15:00Z","project":"/Users/ani/Code/rudy"}
{"event":"end","session_id":"ses-abc123","timestamp":"2026-02-25T09:47:32Z","project":"/Users/ani/Code/rudy","duration_seconds":1952}
{"event":"start","session_id":"ses-def456","timestamp":"2026-02-25T10:02:00Z","project":"/Users/ani/Code/claude-code-tips"}
```

## Install

```json
{
  "hooks": {
    "SessionStart": [{ "type": "command", "command": ".claude/plugins/session-analytics/hooks/session-track.sh" }],
    "SessionEnd": [{ "type": "command", "command": ".claude/plugins/session-analytics/hooks/session-track.sh" }]
  }
}
```

```bash
chmod +x .claude/plugins/session-analytics/hooks/session-track.sh
```

## Querying your data

Since the data is JSONL, you can use `jq` for analysis:

```bash
# Total sessions today
cat ~/.claude/session-analytics.jsonl | jq -s '[.[] | select(.event == "start" and .timestamp >= "2026-02-25")] | length'

# Average session duration (seconds)
cat ~/.claude/session-analytics.jsonl | jq -s '[.[] | select(.duration_seconds != null) | .duration_seconds] | add / length'

# Sessions per project
cat ~/.claude/session-analytics.jsonl | jq -s '[.[] | select(.event == "start")] | group_by(.project) | map({project: .[0].project, count: length}) | sort_by(-.count)'

# Sessions by hour of day (find your peak coding hours)
cat ~/.claude/session-analytics.jsonl | jq -s '[.[] | select(.event == "start") | .timestamp[11:13]] | group_by(.) | map({hour: .[0], count: length}) | sort_by(.hour)'

# Longest sessions
cat ~/.claude/session-analytics.jsonl | jq -s '[.[] | select(.duration_seconds != null)] | sort_by(-.duration_seconds) | .[0:5]'
```

## Privacy

All data stays in `~/.claude/session-analytics.jsonl` on your local machine. Delete the file anytime to clear history.

## Dependencies

- `jq` for JSON parsing
