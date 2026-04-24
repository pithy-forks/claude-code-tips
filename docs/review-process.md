<!-- tested with: claude code v2.1.118 -->

# review process

every pull request gets reviewed by two ai reviewers (claude, codex) and a human (me, sometimes others). this doc explains the contract.

## why this exists

we replaced coderabbit because its review style kept fighting the repo's lowercase-casual voice and generated high-volume low-signal nits (capitalization, em-dash insertion, marketing adjectives). the replacement is structured, opinionated, and consistent: two reviewers reading the same rubric, lanes split so they rarely duplicate, output in a fixed format that dedupes cleanly.

## auth model: github apps, not api keys

both reviewers ride on github app integrations. no repo secrets, no per-token billing, no curl plumbing to maintain. the workflow posts a single comment that `@mention`s each app; the apps respond using the canonical rubric.

- **claude code github app**: install at [github.com/apps/claude](https://github.com/apps/claude). ties the response bot to the maintainer's claude max subscription.
- **openai codex github app**: install from the openai codex integrations page (repo settings -> integrations). ties the response bot to the maintainer's chatgpt plus subscription.

if an app is not installed on this repo, the mention sits unanswered. that is not a ci failure; it is just silence. the workflow exits green either way.

## the team

- **claude** (via the claude code github app): prose, voice, api/contract shape, skill + hook + plugin surface correctness, tests for public paths.
- **codex** (via the openai codex github app): bugs, security, type/shell correctness, dependency hygiene, ci config, shell script robustness.
- **human**: final merge call, trade-offs the bots flagged as discuss, anything that needs context the bots don't have.

## the rubric

canonical contract: [.github/AI_REVIEW_RUBRIC.md](../.github/AI_REVIEW_RUBRIC.md). every reviewer reads it before writing a comment. it encodes:

- the four buckets: blocking, apply, discuss, dismissed
- the output format (one comment per reviewer, exact shape)
- the voice + style rules (auto-dismiss list)
- the lane split (claude vs codex focus)
- the issue-triage format (category + priority + next steps)

changing the rubric changes how every pr gets reviewed. edits to the rubric ship with a changelog entry.

## workflow

file: [.github/workflows/ai-review.yml](../.github/workflows/ai-review.yml)

triggers:

- pull_request opened, ready_for_review (draft prs skipped)
- issues opened (claude only, codex focuses on code)
- workflow_dispatch for manual re-review

on each trigger the workflow posts one comment. pr comments `@mention` both `@claude` and `@codex` and link the rubric. issue comments `@mention` `@claude` only. the apps do the reading and respond inline.

a guard skips posting if the workflow already `@mention`ed `@claude` on the pr within the last 7 days. that prevents re-mention loops if the pr flips between draft and ready multiple times or gets manually re-dispatched.

## repo secrets

- `GITHUB_TOKEN` (default, provided by actions): used to post the `@mention` comment.
- no provider api keys are required. advanced users who want to bypass the apps and call provider apis directly can fork this workflow and add their own secrets, but the default path does not need them.

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

- drop `@claude` from the pr comment body to stop claude reviews.
- drop `@codex` from the pr comment body to stop codex reviews.
- set the whole workflow to `on: workflow_dispatch` only for manual-only mode.
- or uninstall the github app under repo settings -> integrations.

removing coderabbit entirely: the repo-level `.coderabbit.yaml` disables auto-reviews. full app uninstall is done in github repo settings under integrations -> installed github apps -> coderabbit -> configure -> uninstall. that page is behind auth so no link here.

## advanced: bypassing the apps

if you prefer to call provider apis directly (cost visibility, custom model choice, stricter rate control), fork `.github/workflows/ai-review.yml`, add your own provider secrets under repo settings -> secrets and variables -> actions, and replace the mention-comment step with a direct api call. that path is unsupported here; the default repo assumes the app-based flow.
