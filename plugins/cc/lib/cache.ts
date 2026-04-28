// tested with: claude code v2.1.122
/**
 * Tiny TTL cache used to stabilize cc's hot-path responses.
 *
 * Why: cc.check and cc.sessions both run inside a single agent turn, often
 * back-to-back. Within a 200-500ms window the underlying SQLite state is
 * effectively static for that turn. Returning a memoized result has two
 * benefits:
 *
 *  1. Sub-turn calls skip the SQLite round-trip (cheap but not free).
 *  2. **Byte-identical output** across calls within the TTL, which is what
 *     keeps Anthropic's prompt cache hot. If two consecutive cc.check calls
 *     emit slightly different timestamps or peer-ordering, every downstream
 *     prompt-cache entry that includes the digest invalidates.
 *
 * Not a long-lived cache. TTLs are deliberately tight (200-500ms) so cross-
 * turn freshness isn't sacrificed -- the value the user sees in their next
 * digest is always at most one turn old.
 *
 * Caveats:
 *  - Single-process. cc has one MCP child per CC session today.
 *  - Best-effort: the cache is bypassed under exotic clock skew (Date.now()
 *    going backward) -- TTL just elapses.
 */

export interface Clock {
  now(): number;
}

export class TTLCache<K, V> {
  private readonly entries = new Map<K, { value: V; expires_at: number }>();
  private readonly ttl_ms: number;
  private readonly clock: Clock;

  constructor(ttl_ms: number, clock: Clock = { now: () => Date.now() }) {
    if (ttl_ms <= 0) throw new Error("ttl_ms must be positive");
    this.ttl_ms = ttl_ms;
    this.clock = clock;
  }

  /**
   * Return cached value if fresh, else compute, store, return.
   * The compute fn is called at most once per TTL window per key.
   */
  get(key: K, compute: () => V): V {
    const t = this.clock.now();
    const hit = this.entries.get(key);
    if (hit && hit.expires_at > t) return hit.value;
    const value = compute();
    this.entries.set(key, { value, expires_at: t + this.ttl_ms });
    return value;
  }

  /** Bypass + refresh — used by writers that just mutated the underlying state. */
  invalidate(key: K): void {
    this.entries.delete(key);
  }

  /** Drop everything — used at lifecycle stop or after a state-dir wipe. */
  clear(): void {
    this.entries.clear();
  }

  /** Diagnostics. */
  size(): number {
    return this.entries.size;
  }
}
