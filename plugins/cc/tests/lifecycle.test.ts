// tested with: claude code v2.1.122 + bun 1.3
//
// Tests Lifecycle: the registry that owns heartbeat, transcript-tail,
// inbox-watcher, and db.close. Wrong shutdown order leaks file descriptors,
// stuck SQLite handles, and zombie processes -- the real cost.

import { describe, it, expect } from "bun:test";
import { Lifecycle } from "../lib/lifecycle.ts";

describe("Lifecycle", () => {
  it("starts resources in registration order", async () => {
    const lc = new Lifecycle();
    const log: string[] = [];
    lc.add({ name: "a", start: () => void log.push("start:a") });
    lc.add({ name: "b", start: () => void log.push("start:b") });
    lc.add({ name: "c", start: () => void log.push("start:c") });
    await lc.start();
    expect(log).toEqual(["start:a", "start:b", "start:c"]);
  });

  it("stops resources in REVERSE order (LIFO)", async () => {
    const lc = new Lifecycle();
    const log: string[] = [];
    lc.add({ name: "a", stop: () => void log.push("stop:a") });
    lc.add({ name: "b", stop: () => void log.push("stop:b") });
    lc.add({ name: "c", stop: () => void log.push("stop:c") });
    await lc.start();
    await lc.stop();
    expect(log).toEqual(["stop:c", "stop:b", "stop:a"]);
  });

  it("start is idempotent", async () => {
    const lc = new Lifecycle();
    let calls = 0;
    lc.add({ name: "x", start: () => void calls++ });
    await lc.start();
    await lc.start();
    expect(calls).toBe(1);
  });

  it("stop is idempotent", async () => {
    const lc = new Lifecycle();
    let calls = 0;
    lc.add({ name: "x", stop: () => void calls++ });
    await lc.start();
    await lc.stop();
    await lc.stop();
    expect(calls).toBe(1);
  });

  it("resource added after start fires immediately", async () => {
    const lc = new Lifecycle();
    let started = false;
    await lc.start();
    lc.add({ name: "late", start: () => void (started = true) });
    // start() was called via add's runOne; but it's async so wait a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toBe(true);
  });

  it("resource added after stop does NOT fire", async () => {
    const lc = new Lifecycle();
    let started = false;
    await lc.start();
    await lc.stop();
    lc.add({ name: "late", start: () => void (started = true) });
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toBe(false);
  });

  it("error in start() of one resource does not abort others", async () => {
    const lc = new Lifecycle();
    let bStarted = false;
    let cStarted = false;
    lc.add({
      name: "a",
      start: () => {
        throw new Error("boom");
      },
    });
    lc.add({ name: "b", start: () => void (bStarted = true) });
    lc.add({ name: "c", start: () => void (cStarted = true) });
    await lc.start();
    expect(bStarted).toBe(true);
    expect(cStarted).toBe(true);
  });

  it("error in stop() of one resource does not abort others", async () => {
    const lc = new Lifecycle();
    let bStopped = false;
    let aStopped = false;
    lc.add({ name: "a", stop: () => void (aStopped = true) });
    lc.add({ name: "b", stop: () => void (bStopped = true) });
    lc.add({
      name: "c",
      stop: () => {
        throw new Error("boom");
      },
    });
    await lc.start();
    await lc.stop();
    expect(bStopped).toBe(true);
    expect(aStopped).toBe(true);
  });

  it("supports async start/stop with await", async () => {
    const lc = new Lifecycle();
    const log: string[] = [];
    lc.add({
      name: "async",
      start: async () => {
        await new Promise((r) => setTimeout(r, 10));
        log.push("started");
      },
      stop: async () => {
        await new Promise((r) => setTimeout(r, 10));
        log.push("stopped");
      },
    });
    await lc.start();
    expect(log).toEqual(["started"]);
    await lc.stop();
    expect(log).toEqual(["started", "stopped"]);
  });

  it("resources without start or stop fns are silent no-ops", async () => {
    const lc = new Lifecycle();
    lc.add({ name: "noop" });
    lc.add({ name: "start-only", start: () => {} });
    lc.add({ name: "stop-only", stop: () => {} });
    await expect(lc.start()).resolves.toBeUndefined();
    await expect(lc.stop()).resolves.toBeUndefined();
  });
});
