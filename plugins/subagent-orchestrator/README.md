# subagent-orchestrator

Subagent lifecycle tracking and work-stealing scheduling framework. Monitors when subagents start, stop, and go idle -- giving you visibility and control over parallel agent work.

## Concept

When you use Claude Code's agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), multiple subagents run in parallel. But you have no visibility into:

- Which subagents are active right now?
- When did a subagent finish its task?
- Is a teammate sitting idle while others are overloaded?

This plugin hooks into the subagent lifecycle events to build that visibility layer. It also provides a framework for **work-stealing** -- when a teammate goes idle, you can redistribute pending work to it.

## Event flow

```
SubagentStart  -->  Log agent activation, record task assignment
     |
     v
[agent working]
     |
     v
SubagentStop   -->  Log completion, record duration and result
     |
     v
TeammateIdle   -->  Detect idle agent, check work queue, reassign
```

## Hook events

### SubagentStart
Fires when a new subagent is spawned. The JSON payload includes the subagent ID and its assigned task description.

### SubagentStop
Fires when a subagent completes (success or failure). Payload includes the subagent ID, exit status, and duration.

### TeammateIdle
Fires when a teammate in an agent team has no active work. This is the trigger point for work-stealing logic.

## Install

```json
{
  "hooks": {
    "SubagentStart": [{ "type": "command", "command": ".claude/plugins/subagent-orchestrator/hooks/orchestrator.sh" }],
    "SubagentStop": [{ "type": "command", "command": ".claude/plugins/subagent-orchestrator/hooks/orchestrator.sh" }],
    "TeammateIdle": [{ "type": "command", "command": ".claude/plugins/subagent-orchestrator/hooks/orchestrator.sh" }]
  }
}
```

```bash
chmod +x .claude/plugins/subagent-orchestrator/hooks/orchestrator.sh
```

## Customization

The default `orchestrator.sh` only logs events. To implement actual work-stealing, you would:

1. Maintain a work queue (file, SQLite, or in-memory)
2. On `SubagentStart`, dequeue a task and assign it
3. On `SubagentStop`, check if the agent's subtasks spawned new work items
4. On `TeammateIdle`, pop the next item from the queue and feed it to the idle agent

The orchestration logic is inherently project-specific. This plugin gives you the scaffold and event hooks -- you supply the scheduling strategy.

## Log output

Events are appended to `.claude/orchestrator.log`:

```
2026-02-25T14:32:01Z [SubagentStart]  agent=sub-abc123 task="Refactor auth module"
2026-02-25T14:33:45Z [SubagentStop]   agent=sub-abc123 status=success duration=104s
2026-02-25T14:33:46Z [TeammateIdle]   agent=sub-abc123 queue_depth=0
```

## Dependencies

- `jq` for JSON parsing
