# the control plane split - creator vs operator machines

Status: draft - v3 horizon

## summary

most solo devs run everything on their laptop. scheduled jobs, watchers, containers, backups all live next to the editor. this works until the laptop sleeps, travels, or gets closed for the evening. then your cron doesn't fire, your watcher misses events, your backup skips a night.

the pattern: split your compute into two roles. a creator machine you type on, and an operator machine that's always on. different latency tolerances, different trust models, different jobs. this RFC describes the pattern. one reference implementation lives on a separate branch for people who want a concrete starting point.

## scope

this is a teaching-asset RFC. it abstracts the pattern so anyone with a primary workstation plus an always-on secondary (another mac, a linux box, a mini PC, a repurposed old laptop) can apply it. the RFC does not prescribe specific hardware or a specific OS.

### the pattern

**creator machine**:
- high-touch work: IDE, git commits, reviewing PRs, writing, video calls.
- you're present when it's on. it sleeps when you close it.
- trust model: fully authenticated, has your SSH keys, signs commits.
- latency target: human-perceptible. 100ms matters.

**operator machine**:
- always on. hardwired ethernet if possible. display off.
- runs scheduled jobs, watchers, containers, long-running workers.
- you're rarely present. you ssh in to check logs maybe once a week.
- trust model: authenticated but constrained. limited sudo, limited keys, limited network exposure.
- latency target: hours, sometimes minutes. 100ms doesn't matter.

### why this split

- **sleeping laptops break cron**. launchd and systemd won't fire a job if the machine is asleep. moving scheduled work off the laptop means the work actually runs.
- **survive laptop closing**. close the lid, go to dinner, watchers keep polling.
- **continuous freshness without human presence**. PRs get opened overnight. backups complete while you sleep.
- **fewer surprises on the typing machine**. no docker daemon eating RAM while you're editing.

### common confusions

- **"why not one machine?"** sleeping laptops break cron. that's the short version.
- **"why not a VPS?"** three reasons. latency: operator jobs often sync against creator over LAN, VPS adds round-trip. data residency: sensitive material (secrets, personal files, source code) doesn't leave your network. cost: a retired mac mini or a $200 mini PC amortizes faster than a VPS bill. and tailnet keeps the operator off the public internet.
- **"why not a cloud function?"** cold starts (a 5-minute SLA breaks on a 30-second cold start). state (functions are stateless, operators accumulate state by design). billing (per-invocation pricing punishes frequent polls).

### recipes

concrete patterns, no Ani-specific details.

- **scheduled jobs**: launchd (macOS) or systemd-timers (linux) on operator. trigger from creator via SSH-over-tailnet if you need ad-hoc runs. keep plists/units under version control alongside the scripts they run.
- **container host**: OrbStack on macOS operator, or native docker on linux operator. remote CLI from creator: `export DOCKER_HOST=ssh://user@operator-tailnet-name`. same `docker ps`, same `docker compose up`, no docker daemon on the creator.
- **watchers**: operator polls external sources (changelogs, RSS, APIs) on a cadence. when it detects a change, it opens a PR on the relevant repo via the GitHub CLI authenticated on the operator. creator sees the PR notification on next laptop session.
- **backups**: operator pulls from creator via `rsync -a` over tailnet on a schedule. pull is safer than push. creator doesn't need to know about backups. exclusions live in a file on the operator.
- **content sync**: operator runs the hourly `bootstrap --sync` that keeps sibling repos current. creator wakes up and everything is already pulled.

### trust boundaries

- SSH keys: creator has operator's pubkey in its `authorized_keys`. operator has its own distinct key for pulling from creator, scoped to specific paths where possible.
- tailnet ACLs: operator can ssh to creator, creator can ssh to operator. nothing else on tailnet can reach either unless explicitly allowed.
- secrets: API keys needed by operator jobs live on the operator, not synced from creator. rotate separately.
- github: operator has its own gh auth, tied to a scoped personal access token that can open PRs but not force-push to protected branches.

## reference implementation

a work-in-progress scaffold for the operator side lives on the `wip/mini-control-plane` branch. RFC describes the pattern, branch has one implementation (launchd plists, example scripts, a tailnet-auth recipe). treat the branch as a starting point to fork from, not a drop-in solution.

## non-goals

- detailed hardware sizing. get whatever's always-on and has enough RAM for your container workload. anything from a raspberry pi 5 to a used mac mini works.
- specific OS choice. the pattern works on any POSIX-ish OS with a scheduler. macOS and linux both have tailnet clients.
- commercial always-on alternatives (managed VPS with custom agents, cloud desktop services). covered as non-goals above.

## open questions

- **trust boundary between creator and operator**: SSH keys vs tailnet auth vs both? current lean is tailnet for reachability plus SSH keys for specific privileged paths. open to tightening.
- **failure mode when operator is offline**: silent by default, which is bad. need a heartbeat from creator that alerts after N missed checkins. not specified here.
- **upgrades**: when you upgrade the operator OS or the container runtime, jobs go dark for minutes. canary strategy? blue/green by running a second operator during upgrade windows? probably overkill for solo-dev scale but worth documenting.

## links

- `docs/rfcs/freshness-watcher.md` assumes the operator pattern.
- `docs/rfcs/mine-v2-observability.md` will eventually run mine on the operator for cross-device session data.
