#!/usr/bin/env bash
# orchestrator.sh — SubagentStart / SubagentStop / TeammateIdle hook
# Logs subagent lifecycle events. Extend this script to implement
# work-stealing or custom scheduling logic.

set -euo pipefail

LOG_FILE=".claude/orchestrator.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Ensure log directory exists
mkdir -p "$(dirname "${LOG_FILE}")"

# Read JSON payload from stdin
INPUT=$(cat)

# Determine which event triggered this hook
EVENT_TYPE=$(echo "${INPUT}" | jq -r '.hook_event // .event // "unknown"')
AGENT_ID=$(echo "${INPUT}" | jq -r '.agent_id // .subagent_id // "unknown"')
SESSION_ID=$(echo "${INPUT}" | jq -r '.session_id // "unknown"')

case "${EVENT_TYPE}" in
  SubagentStart|subagent_start)
    TASK=$(echo "${INPUT}" | jq -r '.task // .description // "no task description"' | head -c 200)
    echo "${TIMESTAMP} [SubagentStart]  agent=${AGENT_ID} session=${SESSION_ID} task=\"${TASK}\"" >> "${LOG_FILE}"
    ;;

  SubagentStop|subagent_stop)
    STATUS=$(echo "${INPUT}" | jq -r '.status // .exit_status // "unknown"')
    DURATION=$(echo "${INPUT}" | jq -r '.duration // "unknown"')
    echo "${TIMESTAMP} [SubagentStop]   agent=${AGENT_ID} session=${SESSION_ID} status=${STATUS} duration=${DURATION}" >> "${LOG_FILE}"

    # ---------------------------------------------------------
    # WORK-STEALING HOOK POINT
    # After an agent completes, you could check for pending work
    # and spawn a new task. Example:
    #
    # QUEUE_FILE=".claude/work-queue.json"
    # if [ -f "${QUEUE_FILE}" ]; then
    #   NEXT_TASK=$(jq -r '.[0]' "${QUEUE_FILE}")
    #   if [ "${NEXT_TASK}" != "null" ]; then
    #     # Remove from queue and assign to idle agent
    #     jq '.[1:]' "${QUEUE_FILE}" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "${QUEUE_FILE}"
    #     echo "${TIMESTAMP} [Reassign]       agent=${AGENT_ID} next_task=\"${NEXT_TASK}\"" >> "${LOG_FILE}"
    #   fi
    # fi
    # ---------------------------------------------------------
    ;;

  TeammateIdle|teammate_idle)
    echo "${TIMESTAMP} [TeammateIdle]   agent=${AGENT_ID} session=${SESSION_ID}" >> "${LOG_FILE}"

    # ---------------------------------------------------------
    # IDLE DETECTION HOOK POINT
    # When a teammate goes idle, you can redistribute work.
    # This is where your custom scheduling logic goes.
    # ---------------------------------------------------------
    ;;

  *)
    echo "${TIMESTAMP} [Unknown]        event=${EVENT_TYPE} agent=${AGENT_ID}" >> "${LOG_FILE}"
    ;;
esac
