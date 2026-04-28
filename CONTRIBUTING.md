# contributing

thanks for looking at this repo. it's a personal claude code setup turned open source, so contributions are welcome but opinionated about what fits.

## what fits

- new hooks, agents, or skills that are **self-contained examples** someone can copy into their own config
- docs/tips that teach a concept, with real data where it matters
- bug fixes, CI tightening, typo sweeps
- competitive comparison updates (cite pricing pages, changelogs, official sources; no FUD)

## what doesn't

- cross-dependencies between the example hooks/agents/commands (each one should stand alone)
- emojis in files unless explicitly asked for
- personal narrative, private docs, or scratch files (see `.gitignore` and the repo's `no-personal-files` rules)
- em dashes (U+2014) in shipped markdown or JSON; use `-`, `:`, `.`, or `,` instead

## before you open a PR

1. run the CI locally if you can (`plugin-smoke-test`, `validate`, `pr-quality-gate`) or just push and let Actions run
2. tests pass (`bun test plugins/cc/tests` for cc; `pytest plugins/lore/tests` for lore; plugin-smoke-test workflow for all three)
3. no em dashes in files you touched: `grep -RIn $'\xe2\x80\x94' <your files>`
4. commit messages follow conventional format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, `test:`
5. one commit per logical change; no `git add -A` (stage specific files by name)

## testing a plugin locally

```bash
# from a repo that uses claude code
claude --plugin-dir /path/to/claude-code-tips/plugins/cc
# or for lore (knowledge graph)
claude --plugin-dir /path/to/claude-code-tips/plugins/lore
# or for time (resource meters)
claude --plugin-dir /path/to/claude-code-tips/plugins/time
```

the plugin is discovered via `.claude-plugin/plugin.json`; hooks wire up automatically.

## commit signing

commits from humans should be signed (`git commit -S`). automated bot commits (dependabot, release workflows) are exempt.

## questions

open a GitHub issue. for security reports, see [SECURITY.md](./SECURITY.md).
