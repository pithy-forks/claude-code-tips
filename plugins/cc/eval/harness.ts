// Eval harness shared utilities.
//
// Provides:
//   - Harness        per-run state, isolated CLAUDE_CONFIG_DIR, log dir
//   - assert helpers with structured failure capture
//   - waitFor()      polling primitive that records actual converge time
//   - timeIt()       sub-ms scoped timer using performance.now()
//   - distribute()   compute p50/p95/p99 from a sample array
//   - LogSink        peer stderr capture + mcp-traffic.jsonl
//
// Timing principles:
// - All durations use performance.now() (sub-ms resolution, monotonic).
// - We never round before display. Display uses 3 decimal places in ms.
// - We never claim a single-sample number as "p95"; bench mode collects
//   distributions and computes percentiles from real data.
// - waitFor() records the ACTUAL converge time, not a fixed deadline.
//
// Everything writes to a fresh tmpdir per run to keep state isolated.

import * as fs from "node:fs";
import * as path from "node:path";

export type AssertionResult = {
  ok: boolean;
  msg: string;
  expected?: unknown;
  actual?: unknown;
  ms?: number;
};

export type ScenarioResult = {
  name: string;
  ok: boolean;
  duration_ms: number;        // performance.now() delta, full precision
  assertions: AssertionResult[];
  notes?: string[];
  samples?: Record<string, number[]>;   // labeled timing samples (ms)
};

// Sub-ms timer. Returns elapsed ms with full f64 precision.
export function timeIt<T>(fn: () => T): { result: T; ms: number } {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: performance.now() - t0 };
}

export async function timeItAsync<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t0 };
}

// Compute summary stats from a samples array. Sorts in place.
export type Stats = {
  n: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
};

export function distribute(samples: number[]): Stats | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((s, x) => s + x, 0);
  const pick = (q: number): number => {
    if (sorted.length === 1) return sorted[0];
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
    return sorted[idx];
  };
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    p50: pick(0.5),
    p95: pick(0.95),
    p99: pick(0.99),
  };
}

export class Harness {
  readonly runId: string;
  readonly logDir: string;
  readonly claudeDir: string;
  readonly ccStateDir: string;
  readonly notes: string[] = [];
  private assertions: AssertionResult[] = [];
  private startNs = performance.now();
  private samples: Map<string, number[]> = new Map();

  constructor(runId: string) {
    this.runId = runId;
    const here = path.dirname(new URL(import.meta.url).pathname);
    this.logDir = path.join(here, "logs", runId);
    fs.mkdirSync(this.logDir, { recursive: true });
    this.claudeDir = path.join(this.logDir, "claude-config");
    fs.mkdirSync(this.claudeDir, { recursive: true });
    this.ccStateDir = path.join(this.claudeDir, "channels", "cc");
    fs.mkdirSync(this.ccStateDir, { recursive: true });
  }

  note(s: string): void {
    this.notes.push(s);
  }

  expect(name: string, ok: boolean, opts?: { expected?: unknown; actual?: unknown }): void {
    this.assertions.push({
      ok,
      msg: name,
      expected: opts?.expected,
      actual: opts?.actual,
    });
  }

  expectEq<T>(name: string, actual: T, expected: T): void {
    this.expect(name, deepEq(actual, expected), { actual, expected });
  }

  expectGt(name: string, actual: number, threshold: number): void {
    this.expect(name, actual > threshold, { actual, expected: `>${threshold}` });
  }

  expectLt(name: string, actual: number, threshold: number): void {
    this.expect(name, actual < threshold, { actual, expected: `<${threshold}` });
  }

  expectIncludes(name: string, haystack: string, needle: string): void {
    this.expect(name, haystack.includes(needle), { actual: haystack.slice(0, 200), expected: `includes "${needle}"` });
  }

  // Record a labeled timing sample. Use for benchmarks where you want a
  // distribution not a single point.
  recordSample(label: string, ms: number): void {
    let arr = this.samples.get(label);
    if (!arr) {
      arr = [];
      this.samples.set(label, arr);
    }
    arr.push(ms);
  }

  result(name: string): ScenarioResult {
    const samples: Record<string, number[]> = {};
    for (const [k, v] of this.samples) samples[k] = v;
    return {
      name,
      ok: this.assertions.every((a) => a.ok),
      duration_ms: performance.now() - this.startNs,
      assertions: this.assertions,
      notes: this.notes,
      samples,
    };
  }

  // Wait until predicate returns truthy. Polls every `intervalMs` up to `deadlineMs`.
  // Returns { value, ms } so the scenario can assert on the actual converge time.
  // Throws on timeout — caller should expectLt() the recorded ms against the
  // SLO before calling, not after.
  async waitFor<T>(
    label: string,
    fn: () => T | Promise<T>,
    opts: { deadlineMs?: number; intervalMs?: number } = {},
  ): Promise<{ value: T; ms: number }> {
    const deadline = performance.now() + (opts.deadlineMs ?? 5000);
    const interval = opts.intervalMs ?? 25;
    const t0 = performance.now();
    while (performance.now() < deadline) {
      const v = await fn();
      if (v) {
        const ms = performance.now() - t0;
        this.recordSample(`waitFor.${label}`, ms);
        this.note(`waitFor("${label}"): ${ms.toFixed(3)}ms`);
        return { value: v, ms };
      }
      await sleep(interval);
    }
    throw new Error(`waitFor("${label}") timed out after ${(opts.deadlineMs ?? 5000)}ms`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function deepEq<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (typeof a !== "object") return false;
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!deepEq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

export function newRunId(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\.\d+Z$/, "")
    .slice(0, 14); // YYYYMMDDHHMMSS
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

// Format ms with 3 decimal places (sub-ms precision visible).
function fmtMs(n: number): string {
  return n.toFixed(3) + "ms";
}

// Format a scenario result as markdown summary. All numbers are
// performance.now()-derived and rendered with full f64 precision (3 decimal
// places displayed). No averaging single samples.
export function summarize(results: ScenarioResult[]): string {
  const lines: string[] = [];
  lines.push("# cc eval run summary");
  lines.push("");
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const totalMs = results.reduce((s, r) => s + r.duration_ms, 0);
  lines.push(`**${passed}/${total} scenarios pass · ${fmtMs(totalMs)} total wall**`);
  lines.push("");
  lines.push("| scenario | result | duration | assertions |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    const aOk = r.assertions.filter((a) => a.ok).length;
    const aTotal = r.assertions.length;
    lines.push(`| ${r.name} | ${r.ok ? "✅" : "❌"} | ${fmtMs(r.duration_ms)} | ${aOk}/${aTotal} |`);
  }
  // Per-scenario detail when needed (failures or non-trivial notes/samples).
  for (const r of results) {
    const hasFailures = r.assertions.some((a) => !a.ok);
    const hasSamples = r.samples && Object.keys(r.samples).length > 0;
    const hasNotes = r.notes && r.notes.length > 0;
    if (!hasFailures && !hasSamples && !hasNotes) continue;
    lines.push("");
    lines.push(`## ${r.name}`);
    if (hasSamples) {
      lines.push("");
      lines.push("| label | n | min | p50 | p95 | p99 | max | mean |");
      lines.push("|---|---|---|---|---|---|---|---|");
      for (const [label, samples] of Object.entries(r.samples!)) {
        const s = distribute(samples);
        if (!s) continue;
        lines.push(
          `| ${label} | ${s.n} | ${fmtMs(s.min)} | ${fmtMs(s.p50)} | ${fmtMs(s.p95)} | ${fmtMs(s.p99)} | ${fmtMs(s.max)} | ${fmtMs(s.mean)} |`,
        );
      }
    }
    if (hasNotes) {
      lines.push("");
      lines.push("notes:");
      for (const n of r.notes!) lines.push(`- ${n}`);
    }
    const failed = r.assertions.filter((a) => !a.ok);
    if (failed.length) {
      lines.push("");
      lines.push("failures:");
      for (const a of failed) {
        lines.push(`- **${a.msg}** — expected: \`${JSON.stringify(a.expected)}\` actual: \`${JSON.stringify(a.actual)}\``);
      }
    }
  }
  return lines.join("\n");
}
