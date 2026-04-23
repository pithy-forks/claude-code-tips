<!-- tested with: claude code v2.1.118 -->

# review process

every pull request gets reviewed by two ai reviewers (claude, codex) and a human (me, sometimes others). this doc explains the contract.

## why this exists

we replaced coderabbit because its review style kept fighting the repo's lowercase-casual voice and generated high-volume low-signal nits (capitalization, em-dash insertion, marketing adjectives). the replacement is structured, opinionated, and consistent: two reviewers reading the same rubric, lanes split so they rarely duplicate, output in a fixed format that dedupes cleanly.

## the team

- **claude** (anthropic api, via `anthropics/claude-code-action`): prose, voice, api/contract shape, skill + hook + plugin surface correctness, tests for public paths.
- **codex** (openai responses api, o3-mini default): bugs, security, type/shell correctness, dependency hygiene, ci config, shell script robustness.
- **human**: final merge call, trade-offs the bots flagged as discuss, anything that needs context the bots don't have.

## the rubric

canonical contract: [.github/AI_REVIEW_RUBRIC.md](../.github/AI_REVIEW_RUBRIC.md). every reviewer reads it before writing a comment. it encodes:

- the four buckets: blocking, apply, discuss, dismissed
- the output format (one comment per reviewer, exact shape)
- the voice + style rules (auto-dismiss list)
- the lane split (claude vs codex focus)

changing the rubric changes how every pr gets reviewed. edits to the rubric ship with a changelog entry.

## workflow

file: [.github/workflows/ai-review.yml](../.github/workflows/ai-review.yml)

triggers:
- pull_request opened, synchronize, reopened, ready_for_review (draft prs skipped)
- issues opened (claude only, codex focuses on code)
- workflow_dispatch for manual re-review

each reviewer runs as a separate job. both read the rubric. both post a single pr comment. output format is identical, so skimming the two reviews side by side is fast.

## secrets required

- `ANTHROPIC_API_KEY` for claude
- `OPENAI_API_KEY` for codex
- `GITHUB_TOKEN` (default) for posting comments

set both in repo settings -> secrets and variables -> actions.

## what the bots do not do

- they do not auto-merge. `dependabot-auto-merge.yml` handles that for dependabot-only prs with trusted update types.
- they do not close issues. triage suggestion only.
- they do not fight each other. if both flag the same line, the rubric dedupes by `path:line`.
- they do not lint. markdown-lint, hook-syntax, json-validation stay in `validate.yml`. the review team reasons about the diff, not format.

## autonomous maintenance loop

the bigger picture this fits into:

1. anthropic publishes a claude code release
2. `freshness-check.yml` (or the planned freshness-watcher on the always-on machine) opens a draft pr with version-stamp + changelog excerpt (see [docs/rfcs/freshness-watcher.md](./rfcs/freshness-watcher.md))
3. the ai-review-team reviews the pr against the rubric
4. if only version-stamp + changelog changes and all checks green, `dependabot-auto-merge`-style logic merges automatically
5. if anything non-trivial, human gets a notification

## dismissed coderabbit style suggestions

the rubric auto-filters these. future reviewers should keep filtering:

- add em dashes for emphasis
- capitalize x (trademark / proper-noun style)
- add emojis
- expand to make more "comprehensive" or "robust"
- reorganize the intro to have a "why" section

these fight the voice and the abstractable-pattern test that tips are held to. adding them would make the repo feel like generic ai-generated docs.

## turning off a reviewer

edit `.github/workflows/ai-review.yml`:

- remove the `claude-review` job to stop claude reviews.
- remove the `codex-review` job to stop codex reviews.
- set the whole workflow to `on: workflow_dispatch` only for manual-only mode.

removing coderabbit entirely: the repo-level `.coderabbit.yaml` disables auto-reviews; full app uninstall is done at [repo settings -> integrations](https://github.com/anipotts/claude-code-tips/settings/installations).
