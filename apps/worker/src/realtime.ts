import { type Tick, createLivePriceBook } from "@app/core";
import type { MarketCache } from "@app/store";

export interface LivePricesDeps {
  readonly cache: MarketCache;
  /** One starter per exchange stream (Coinbase, Kraken, …). */
  readonly streams: readonly ((onTicks: (ticks: Tick[]) => void) => { stop(): void })[];
  readonly flushMs: number;
  readonly maxTickAgeMs: number;
  readonly now: () => number;
}

/**
 * Collects ticks from the exchange streams and publishes the per-symbol median at most once per
 * `flushMs` (only symbols that changed), keeping browser updates smooth and cheap.
 */
export function startLivePrices(deps: LivePricesDeps): { stop(): void } {
  const book = createLivePriceBook({ maxAgeMs: deps.maxTickAgeMs });
  const onTicks = (ticks: Tick[]) => ticks.forEach((t) => book.add(t));
  const streams = deps.streams.map((start) => start(onTicks));
  const timer = setInterval(() => {
    const updates = book.flush(deps.now());
    if (updates.length > 0) void deps.cache.publishLive(updates);
  }, deps.flushMs);

  return {
    stop() {
      clearInterval(timer);
      streams.forEach((s) => s.stop());
    },
  };
}
