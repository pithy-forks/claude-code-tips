#!/usr/bin/env bun
// cc eval orchestrator.
//
// Usage:
//   bun eval/run.ts                  # run all scenarios
//   bun eval/run.ts 01 03            # run by scenario number prefix
//   bun eval/run.ts --filter cold    # run scenarios whose name contains "cold"
//   bun eval/run.ts --keep-logs      # don't clean up the per-run dir on success
//
// Each run gets a fresh logs/<runId>/ dir with:
//   summary.md                  ← markdown report (real measurements only)
//   summary.json                ← structured form for tooling
//   <peer>.stderr               ← cc-server stderr (CC_DEBUG trace lines)
//   <peer>-traffic.jsonl        ← every JSON-RPC line in/out, timestamped
//   claude-config/channels/cc/  ← isolated cc state dir
//
// Numbers in summary.md are all real performance.now() measurements.
// No averages of single samples are claimed as percentiles.

import * as fs from "node:fs";
import * as path from "node:path";
import { Harness, summarize, newRunId, type ScenarioResult } from "./harness.js";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PLUGIN_ROOT = path.dirname(HERE); // plugins/cc/

type ScenarioModule = {
  scenarioName: string;
  default: (h: Harness, pluginRoot: string) => Promise<void>;
};

async function loadScenarios(): Promise<ScenarioModule[]> {
  const dir = path.join(HERE, "scenarios");
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+-.*\.ts$/.test(f))
    .sort();
  const out: ScenarioModule[] = [];
  for (const f of files) {
    const mod = (await import(path.join(dir, f))) as ScenarioModule;
    if (typeof mod.default !== "function" || typeof mod.scenarioName !== "string") {
      console.warn(`skipping ${f}: missing default export or scenarioName`);
      continue;
    }
    out.push(mod);
  }
  return out;
}

function applyFilter(scenarios: ScenarioModule[], argv: string[]): ScenarioModule[] {
  const filterFlagIdx = argv.indexOf("--filter");
  let filterStr: string | null = null;
  if (filterFlagIdx >= 0) {
    filterStr = argv[filterFlagIdx + 1] ?? null;
  }
  const numericFilters = argv.filter((a) => /^\d+$/.test(a));

  return scenarios.filter((s) => {
    if (filterStr && !s.scenarioName.includes(filterStr)) return false;
    if (numericFilters.length > 0) {
      const matches = numericFilters.some((n) => s.scenarioName.startsWith(`${n.padStart(2, "0")}-`));
      if (!matches) return false;
    }
    return true;
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const keepLogs = argv.includes("--keep-logs");
  // --bench N: run each scenario N times, aggregate samples into a
  // distribution. Default N=1 (single shot — fastest, no warmup amortization).
  const benchIdx = argv.indexOf("--bench");
  const benchRuns = benchIdx >= 0 ? Math.max(2, parseInt(argv[benchIdx + 1] ?? "10", 10) || 10) : 1;
  const scenarios = applyFilter(await loadScenarios(), argv);

  if (scenarios.length === 0) {
    console.error("no scenarios matched");
    process.exit(2);
  }

  const runId = newRunId();
  console.log(`# cc eval — run ${runId}${benchRuns > 1 ? ` (bench mode: ${benchRuns}× per scenario)` : ""}`);
  console.log(`scenarios: ${scenarios.map((s) => s.scenarioName).join(", ")}`);
  console.log("");

  const results: ScenarioResult[] = [];
  for (const s of scenarios) {
    if (benchRuns === 1) {
      process.stdout.write(`▶ ${s.scenarioName} ...`);
      const h = new Harness(`${runId}__${s.scenarioName}`);
      try {
        await s.default(h, PLUGIN_ROOT);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        h.expect(`scenario raised: ${e.message}`, false, { actual: e.stack });
      }
      const r = h.result(s.scenarioName);
      results.push(r);
      process.stdout.write(`  ${r.ok ? "✅" : "❌"} ${r.duration_ms.toFixed(3)}ms\n`);
    } else {
      // Bench: run N times, accumulate samples per label. Each iteration uses
      // its own fresh Harness/CLAUDE_CONFIG_DIR, so stat noise is real and
      // not amortized via shared state. Slowest per scenario but produces
      // honest distributions.
      process.stdout.write(`▶ ${s.scenarioName} (×${benchRuns})\n`);
      const aggSamples = new Map<string, number[]>();
      let allPassed = true;
      let totalDuration = 0;
      const allAssertions: ScenarioResult["assertions"] = [];
      const allNotes: string[] = [];
      for (let i = 0; i < benchRuns; i++) {
        const h = new Harness(`${runId}__${s.scenarioName}__iter${i + 1}`);
        try {
          await s.default(h, PLUGIN_ROOT);
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          h.expect(`scenario raised: ${e.message}`, false, { actual: e.stack });
        }
        const r = h.result(s.scenarioName);
        if (!r.ok) allPassed = false;
        totalDuration += r.duration_ms;
        for (const [label, samples] of Object.entries(r.samples ?? {})) {
          let arr = aggSamples.get(label);
          if (!arr) {
            arr = [];
            aggSamples.set(label, arr);
          }
          for (const v of samples) arr.push(v);
        }
        // only keep assertions/notes from the first iteration to avoid spam
        if (i === 0) {
          for (const a of r.assertions) allAssertions.push(a);
          if (r.notes) for (const n of r.notes) allNotes.push(n);
        }
        process.stdout.write(`  ${i + 1}/${benchRuns} ${r.ok ? "✅" : "❌"} ${r.duration_ms.toFixed(3)}ms\n`);
      }
      const merged: ScenarioResult = {
        name: s.scenarioName,
        ok: allPassed,
        duration_ms: totalDuration,
        assertions: allAssertions,
        notes: [
          ...allNotes,
          `bench mode: ${benchRuns} iterations; samples below are the union across iterations`,
        ],
        samples: Object.fromEntries(aggSamples),
      };
      results.push(merged);
    }
  }

  // Aggregate summary into the FIRST scenario's run dir (or a top-level
  // one if no scenarios). We use the run id as the discriminator.
  const summaryDir = path.join(HERE, "logs", runId);
  fs.mkdirSync(summaryDir, { recursive: true });
  const summaryMd = summarize(results);
  fs.writeFileSync(path.join(summaryDir, "summary.md"), summaryMd);
  fs.writeFileSync(path.join(summaryDir, "summary.json"), JSON.stringify(results, null, 2));

  console.log("");
  console.log(summaryMd);
  console.log("");
  console.log(`logs: ${summaryDir}`);
  console.log(`per-scenario logs: ${path.join(HERE, "logs", `${runId}__<scenarioName>`)}`);

  if (!keepLogs && results.every((r) => r.ok)) {
    // Successful runs auto-clean their per-scenario dirs to keep the logs
    // tree tidy. The summary dir stays. --keep-logs to retain everything.
    for (const r of results) {
      const d = path.join(HERE, "logs", `${runId}__${r.name}`);
      if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
    }
  }

  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

await main();
