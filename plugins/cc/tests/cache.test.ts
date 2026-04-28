// tested with: claude code v2.1.122 + bun 1.3
//
// Tests TTLCache: the cache that backs liveSessions() and recentFilesFor()
// and is responsible for byte-stable cc.check output within an agent turn
// (prompt-cache invariant).

import { describe, it, expect } from "bun:test";
import { TTLCache, type Clock } from "../lib/cache.ts";

class FakeClock implements Clock {
  private t: number;
  constructor(t = 0) {
    this.t = t;
  }
  now() {
    return this.t;
  }
  advance(by: number) {
    this.t += by;
  }
}

describe("TTLCache", () => {
  it("computes once within ttl, returns cached", () => {
    const clock = new FakeClock();
    const cache = new TTLCache<string, number>(100, clock);
    let calls = 0;
    const compute = () => {
      calls++;
      return 42;
    };
    expect(cache.get("k", compute)).toBe(42);
    expect(cache.get("k", compute)).toBe(42);
    expect(cache.get("k", compute)).toBe(42);
    expect(calls).toBe(1);
  });

  it("recomputes after ttl expires", () => {
    const clock = new FakeClock();
    const cache = new TTLCache<string, number>(100, clock);
    let calls = 0;
    const compute = () => {
      calls++;
      return calls;
    };
    expect(cache.get("k", compute)).toBe(1);
    clock.advance(99);
    expect(cache.get("k", compute)).toBe(1); // still fresh
    clock.advance(2); // 101 elapsed: stale
    expect(cache.get("k", compute)).toBe(2);
  });

  it("separates keys", () => {
    const clock = new FakeClock();
    const cache = new TTLCache<string, string>(100, clock);
    let calls = 0;
    const compute = (label: string) => () => {
      calls++;
      return label;
    };
    expect(cache.get("a", compute("alpha"))).toBe("alpha");
    expect(cache.get("b", compute("beta"))).toBe("beta");
    expect(cache.get("a", compute("DROPPED"))).toBe("alpha"); // cached
    expect(calls).toBe(2);
  });

  it("invalidate forces recompute on next get", () => {
    const clock = new FakeClock();
    const cache = new TTLCache<string, number>(100, clock);
    let calls = 0;
    const compute = () => ++calls;
    cache.get("k", compute);
    cache.invalidate("k");
    cache.get("k", compute);
    expect(calls).toBe(2);
  });

  it("clear drops every key", () => {
    const cache = new TTLCache<string, number>(100);
    cache.get("a", () => 1);
    cache.get("b", () => 2);
    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("rejects non-positive ttl", () => {
    expect(() => new TTLCache<string, number>(0)).toThrow();
    expect(() => new TTLCache<string, number>(-1)).toThrow();
  });

  it("returns reference-stable values within ttl (byte stability)", () => {
    // The point: prompt cache hits when output bytes are identical. If the
    // cache returned a fresh object on each call (even with same fields),
    // JSON.stringify could still produce identical bytes -- but here we
    // verify the TYPE returned is the SAME REFERENCE within ttl, which is
    // the strongest stability guarantee.
    const clock = new FakeClock();
    const cache = new TTLCache<string, { ts: number; rows: number[] }>(100, clock);
    const v1 = cache.get("k", () => ({ ts: clock.now(), rows: [1, 2, 3] }));
    const v2 = cache.get("k", () => ({ ts: 999, rows: [9, 9, 9] }));
    expect(v1).toBe(v2); // same reference
    expect(v2.ts).toBe(0);
  });
});
