/** Bounded, settled-value cache: never store request-owned promises. */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number, private capacity: number) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): T {
    this.entries.delete(key);
    for (const [storedKey, entry] of this.entries) {
      if (entry.expires <= now) this.entries.delete(storedKey);
    }
    while (this.entries.size >= this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expires: now + this.ttlMs });
    return value;
  }
}

/** All queue promises belong to this invocation, not a module-level singleton. */
export function createRequestPool(limit = 6) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(work: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    else active += 1;
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  };
}