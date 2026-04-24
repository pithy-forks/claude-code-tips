<!-- tested with: claude code v2.1.118 -->

# auto-merge policy

prs from the repo owner, from trusted bots, or from autonomous-agent branch namespaces have auto-merge enabled automatically. github still waits for all required ci checks to pass before the merge fires. red ci blocks the merge the same way it always did.

## who gets auto-merge

enabled automatically on pr open, reopen, ready-for-review, or synchronize:

- **author `anipotts`** (repo owner)
- **bots**: `dependabot[bot]`, `github-actions[bot]`, `pre-commit-ci[bot]`, anything matching `claude*[bot]` or `codex*[bot]`
- **autonomous branch namespaces**: `claude/`, `auto/`, `release/`, `chore/`, `fix/`

## who does not

everyone else. outside contributors still need a maintainer to enable merge manually. that's a deliberate choice, not an oversight: a trusted-by-default policy only works when you actually trust the author or the branch convention.

## how the workflow decides

[.github/workflows/auto-merge-autonomous.yml](../.github/workflows/auto-merge-autonomous.yml) runs on every non-draft pr. the `check trust list` step walks three rules in order:

1. author login match against the trusted list
2. author type is `Bot` + login matches a trusted prefix
3. branch name starts with a trusted namespace

the first match wins. if none match, the workflow logs the reason and exits without touching auto-merge.

## merge method

regular merge (`--merge`), not squash. preserves commit history, matches the repo's no-squash rule in memory. `delete_branch_on_merge` is true in repo settings so the head branch cleans up automatically.

## failure modes

- **ci is red**: github holds the merge. the pr sits open until ci goes green or a human force-merges.
- **branch is behind main**: github auto-updates the head branch if `allow_auto_merge` + `allow_update_branch` are both on in repo settings. check both stay true.
- **a required status check never reports**: merge never fires. flag it in the review rubric so the reviewer can see something is off before signing off.
- **trust-list drift**: if you start using a new autonomous-agent namespace (e.g. `bot/`), add it to the `case "$BRANCH"` block in the workflow. the workflow version-stamps to track when the trust list was last audited.

## disabling

edit the workflow file. either:
- remove the `enable auto-merge` step entirely to stop enabling new auto-merges
- tighten the trust list to a smaller set (e.g. drop the branch-namespace rule)
- add the workflow path to branch protection's required checks and set the check to always fail -> blocks merges until manually overridden

## relationship to the ai-review-team

auto-merge and [ai-review-team](./review-process.md) are independent layers. review posts feedback on every pr; auto-merge decides when to actually merge. a pr with a blocking review comment still merges if ci is green and the trust list approves. if you want the review team to actually block merges, add `ai-review-team/claude` and `ai-review-team/codex` to the required-checks list in branch protection.
