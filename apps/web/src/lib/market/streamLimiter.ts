/** Concurrent long-lived connections per client key (IP). Keys vanish when their count drops to zero. */
export function createStreamLimiter(maxPerKey: number) {
  let counts = new Map<string, number>();
  return {
    /** Returns a release function, or null when the key is at its limit. */
    acquire(key: string): (() => void) | null {
      const current = counts.get(key) ?? 0;
      if (current >= maxPerKey) return null;
      counts = new Map(counts).set(key, current + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const n = (counts.get(key) ?? 1) - 1;
        counts = new Map(counts);
        if (n <= 0) counts.delete(key);
        else counts.set(key, n);
      };
    },
  };
}
