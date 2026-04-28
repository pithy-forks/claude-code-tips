<!-- tested with: claude code v2.1.122 -->

# ai review rubric

canonical review contract for the ai-review-team workflow. every reviewer (claude, codex, future ones) reads this before posting a review. the rubric is what makes dual-reviewer output consistent instead of two different bots shouting past each other.

## voice + style constraints (always enforced, never suggest overrides)

- lowercase casual voice. "bc" not "because". do not suggest title case, do not suggest adding capitalization for emphasis.
- no em dashes (u+2014). never suggest adding them. if you see one in a shipped `.md` or `.json` file, flag it as blocking.
- no emojis unless the file already uses them (rare). never suggest adding emojis.
- no marketing adjectives in prose: "comprehensive", "robust", "seamless", "leverage", "delve", "crucial", "essential", "streamline", "empower", "unleash", "at its core", "in essence". flag in apply.
- trademarks stay lowercase to match voice (mac mini, github, claude code). do not suggest capitalization.
- prose is scannable: short sentences, concrete examples, no filler.

## output format (every review)

post a single pr comment with this exact shape. reviewers that cannot produce this shape do not run.

```
## review summary

- verdict: approve | request_changes | comment
- confidence: high | medium | low
- reviewer: claude | codex | <name>
- commit reviewed: <sha>

## blocking

issues that must be fixed before merge. bugs, security, broken references, em dashes in shipped files, non-green ci.

- [ ] `path:line` short description + proposed fix

## apply

actionable improvements that are not blocking. voice cleanups, dead code, missing tests, clearer naming, low-risk refactors.

- [ ] `path:line` short description + proposed fix

## discuss

trade-offs. architectural concerns. anything where the reviewer is not confident about the right answer.

- `path:line` concern + the alternatives the reviewer considered

## dismissed (auto-filter summary)

count only. examples of what was auto-filtered: em-dash suggestions, capitalization nits, emoji requests, marketing-adjective additions.

- filtered N items
```

## what counts as blocking

- functional bug with reproducer
- security: secrets, command injection, path traversal, unsafe deserialization, missing input validation at a system boundary
- breaking change to a public surface (plugin.json, mcp tool shape, skill frontmatter) without a changelog entry
- em dashes in shipped `.md` or `.json`
- broken cross-reference (link to a file that does not exist)
- ci failure that the reviewer can diagnose from the diff

## what counts as apply

- voice cleanup
- dead code
- missing test for a new public path
- clearer variable name
- overly broad error handling
- redundant code that a single line would express

## what counts as discuss

- architecture choice (monorepo vs split repo, sync vs async, mcp tool vs hook)
- what belongs in this pr vs a follow-up
- compatibility bet (will this break for older versions of cc?)
- voice judgement calls the rubric does not resolve

## what gets auto-dismissed

the reviewer does not post these. count them in the dismissed summary only.

- "add em dashes"
- "capitalize x"
- "add emojis"
- "make more comprehensive / robust / seamless"
- "expand the introduction"
- "add a table of contents"
- "add a 'why' section" if the pr description already explains why
- whitespace-only nits
- suggestions to reorganize files for the sake of reorganizing

## reviewer-specific guidance

- **claude**: focus on prose, voice, api/contract shape, skill + hook + plugin surface correctness, tests for the public path. skip low-level perf micro-nits unless the diff changes a hot loop.
- **codex**: focus on bugs, security, type/shell correctness, dependency hygiene, ci config, shell script robustness, python + typescript patterns. skip voice + marketing adjectives (claude handles those).

overlap is fine when both reviewers spot the same issue; the rubric's `apply` / `blocking` dedup is by `path:line`.

## issue triage

when mentioned on a new issue, post a single comment in this exact shape:

```
## triage

- category: bug | feature | docs | question | other
- priority: p0 | p1 | p2 | p3
- summary: one paragraph, no filler

## next steps

- [ ] concrete first action (who does what)
- [ ] concrete second action
- [ ] concrete third action (optional)
```

voice rules from the top of this file still apply. no em dashes, no marketing adjectives, lowercase trademarks. priority guidance: p0 = broken main path, p1 = blocks a user this week, p2 = nice to have, p3 = someday.

## frequency + trigger

- opened, ready_for_review on pull_request (draft prs skipped).
- opened on issues (claude only; codex focuses on code).
- manual trigger via `workflow_dispatch` for re-review.
