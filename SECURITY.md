# security

## reporting a vulnerability

if you find a security issue in this repo (hook that can be abused, plugin that leaks data, code-execution path, credential handling bug), please report privately before opening a public issue.

- GitHub Security Advisories: https://github.com/anipotts/claude-code-tips/security/advisories/new
- or email: `ap7564` at `nyu.edu`

expected response: within 72 hours for triage.

## scope

in scope:
- hooks in `hooks/` and `plugins/*/hooks/`
- MCP server code in `plugins/cc/server.ts`
- skill/command prompts that invoke shell via `Bash`
- CI workflows that run untrusted input

out of scope:
- upstream Claude Code CLI vulnerabilities (report to Anthropic)
- dependencies with upstream fixes available (open a PR instead)
- issues that require already-compromised local access (this is a personal config repo; local access trust is assumed)

## known accepted risks

- `cleanupPeriodDays: 999999` retains transcripts indefinitely in the user's local `~/.claude/projects/`. transcripts are unencrypted plaintext. mitigations: FileVault disk encryption, `~/.claude/rules/no-personal-files.md` blocks accidental commits. users who run this plugin set should understand the retention implication.
- `mine.db` stores session metadata locally. it is not shared, transmitted, or uploaded by default.

## supply chain

dependencies are pinned and monitored via Dependabot. security alerts are triaged weekly.
