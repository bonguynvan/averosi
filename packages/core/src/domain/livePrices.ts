/**
 * Realtime reference price: median of the latest tick from each source, ignoring stale ticks.
 * Display-grade numbers (USD); the authoritative bigint aggregation remains getMarketOverview.
 */
export interface Tick {
  readonly symbol: string;
  readonly source: string;
  readonly price: number;
  readonly at: number; // unix ms
}

export interface LivePriceUpdate {
  readonly symbol: string;
  readonly priceUsd: number;
  readonly sources: number;
  readonly at: number;
}

export interface LivePriceBook {
  add(tick: Tick): void;
  /** Updates for symbols that received ticks since the previous flush. */
  flush(now: number): LivePriceUpdate[];
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function createLivePriceBook({ maxAgeMs }: { maxAgeMs: number }): LivePriceBook {
  const latest = new Map<string, Map<string, Tick>>();
  let dirty = new Set<string>();

  return {
    add(tick) {
      if (!Number.isFinite(tick.price) || tick.price <= 0) return;
      const bySource = latest.get(tick.symbol) ?? new Map<string, Tick>();
      latest.set(tick.symbol, bySource.set(tick.source, tick));
      dirty.add(tick.symbol);
    },
    flush(now) {
      const symbols = [...dirty].sort();
      dirty = new Set();
      return symbols.flatMap((symbol) => {
        const fresh = [...(latest.get(symbol)?.values() ?? [])].filter((t) => now - t.at <= maxAgeMs);
        if (fresh.length === 0) return [];
        return [{ symbol, priceUsd: median(fresh.map((t) => t.price)), sources: fresh.length, at: Math.max(...fresh.map((t) => t.at)) }];
      });
    },
  };
}
