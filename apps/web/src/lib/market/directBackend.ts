import { type FxSource, type MarketSource, type Timeframe, getMarketOverview, indicatorSnapshot } from "@app/core";
import { type CandleSource, candleTtlMs, createTtlCache } from "@app/market-data";
import { MICROS, type MarketBackend } from "./backend";
import { createLiveHub } from "./liveHub";

const OVERVIEW_TTL_MS = 60_000;
const LIVE_POLL_MS = 15_000;

export interface DirectDeps {
  readonly sources: readonly MarketSource[];
  readonly fx: FxSource;
  readonly candleSource: CandleSource;
  readonly symbols: readonly string[];
}

/** No infrastructure: fetch on demand with in-process caches. "Live" = overview polled every 15s. */
export function createDirectBackend(deps: DirectDeps): MarketBackend {
  const overviewCache = createTtlCache({ ttlMs: OVERVIEW_TTL_MS });
  const candleCaches = new Map<Timeframe, ReturnType<typeof createTtlCache>>();
  const cacheFor = (tf: Timeframe) => {
    const existing = candleCaches.get(tf) ?? createTtlCache({ ttlMs: candleTtlMs(tf) });
    candleCaches.set(tf, existing);
    return existing;
  };

  const backend: MarketBackend = {
    kind: "direct",
    overview: () => overviewCache.get("overview", () => getMarketOverview({ sources: deps.sources, fx: deps.fx }, { symbols: deps.symbols })),
    candles: (symbol, tf) => cacheFor(tf).get(symbol, () => deps.candleSource.candles(symbol, tf)),
    async indicators(symbol, timeframe) {
      const { bars } = await backend.candles(symbol, timeframe);
      const last = bars.at(-1);
      return last ? { symbol, timeframe, computedAt: new Date(), lastBarTime: last.time, snapshot: indicatorSnapshot(bars) } : null;
    },
    subscribeLive: (listener) => hub.subscribe(listener),
  };

  const hub = createLiveHub(async (emit) => {
    const push = async () => {
      const { assets } = await backend.overview();
      emit(assets.map((a) => ({ symbol: a.symbol, priceUsd: Number(a.priceUsdMicros) / MICROS, sources: a.sources.length, at: Date.now() })));
    };
    void push().catch(() => undefined);
    const timer = setInterval(() => void push().catch(() => undefined), LIVE_POLL_MS);
    return async () => clearInterval(timer);
  });

  return backend;
}
