#!/usr/bin/env bash
# session-track.sh — SessionStart / SessionEnd hook
# Logs session lifecycle events to ~/.claude/session-analytics.jsonl

set -euo pipefail

ANALYTICS_FILE="${HOME}/.claude/session-analytics.jsonl"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EPOCH=$(date +%s)

# Ensure directory exists
mkdir -p "$(dirname "${ANALYTICS_FILE}")"

# Read JSON payload from stdin
INPUT=$(cat)

# Extract event type and session metadata
EVENT_TYPE=$(echo "${INPUT}" | jq -r '.hook_event // .event // "unknown"')
SESSION_ID=$(echo "${INPUT}" | jq -r '.session_id // "unknown"')
PROJECT_DIR=$(echo "${INPUT}" | jq -r '.cwd // .project_dir // "unknown"')

# Normalize event type
case "${EVENT_TYPE}" in
  SessionStart|session_start)
    EVENT="start"
    ;;
  SessionEnd|session_end)
    EVENT="end"
    ;;
  *)
    EVENT="${EVENT_TYPE}"
    ;;
esac

if [ "${EVENT}" = "start" ]; then
  # Record session start
  # Also write a temp file to calculate duration on end
  START_FILE="/tmp/claude-session-${SESSION_ID}.start"
  echo "${EPOCH}" > "${START_FILE}"

  jq -n \
    --arg event "${EVENT}" \
    --arg session_id "${SESSION_ID}" \
    --arg timestamp "${TIMESTAMP}" \
    --arg project "${PROJECT_DIR}" \
    '{event: $event, session_id: $session_id, timestamp: $timestamp, project: $project}' \
    >> "${ANALYTICS_FILE}"

elif [ "${EVENT}" = "end" ]; then
  # Calculate duration if we have a start timestamp
  START_FILE="/tmp/claude-session-${SESSION_ID}.start"
  DURATION="null"

  if [ -f "${START_FILE}" ]; then
    START_EPOCH=$(cat "${START_FILE}")
    DURATION=$((EPOCH - START_EPOCH))
    rm -f "${START_FILE}"
  fi

  jq -n \
    --arg event "${EVENT}" \
    --arg session_id "${SESSION_ID}" \
    --arg timestamp "${TIMESTAMP}" \
    --arg project "${PROJECT_DIR}" \
    --argjson duration "${DURATION}" \
    '{event: $event, session_id: $session_id, timestamp: $timestamp, project: $project, duration_seconds: $duration}' \
    >> "${ANALYTICS_FILE}"

else
  # Unknown event -- log it anyway
  jq -n \
    --arg event "${EVENT}" \
    --arg session_id "${SESSION_ID}" \
    --arg timestamp "${TIMESTAMP}" \
    '{event: $event, session_id: $session_id, timestamp: $timestamp}' \
    >> "${ANALYTICS_FILE}"
fi
