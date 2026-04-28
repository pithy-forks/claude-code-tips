// tested with: claude code v2.1.122
/**
 * Lifecycle: a small ordered registry of resources with start/stop hooks.
 *
 * cc has four background concerns that all need to start after MCP connect
 * and stop on shutdown: heartbeat, inbox watcher, transcript tail, sqlite db.
 * Without this, each gets its own try/catch chain in server.ts and the
 * shutdown path forgets one half the time. This module is the single
 * coordination point.
 *
 * Stop semantics:
 *  - resources stop in REVERSE registration order (LIFO), so dependents
 *    finish before their dependencies (e.g. heartbeat stops before db
 *    closes, since heartbeat writes to db)
 *  - errors during stop are logged to stderr but don't abort the rest;
 *    a half-broken shutdown is better than a stuck process
 *  - stop() is idempotent: calling it twice is a noop
 */

export type Resource = {
  name: string;
  start?: () => void | Promise<void>;
  stop?: () => void | Promise<void>;
};

export class Lifecycle {
  private readonly resources: Resource[] = [];
  private started = false;
  private stopped = false;

  /**
   * Register a resource. Safe to call before or after start(); resources
   * registered after start() begin immediately.
   */
  add(r: Resource): void {
    this.resources.push(r);
    if (this.started && !this.stopped && r.start) {
      this.runOne(r, "start");
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    for (const r of this.resources) {
      if (r.start) await this.runOne(r, "start");
    }
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    // LIFO: dependents stop before dependencies.
    for (const r of [...this.resources].reverse()) {
      if (r.stop) await this.runOne(r, "stop");
    }
  }

  private async runOne(r: Resource, phase: "start" | "stop"): Promise<void> {
    try {
      const fn = phase === "start" ? r.start : r.stop;
      if (fn) await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`cc: lifecycle.${r.name}.${phase} failed: ${msg}\n`);
    }
  }
}
