import { type FxSource, type MarketSource, type Timeframe, type UniverseAsset, getMarketOverview, indicatorSnapshot } from "@app/core";
import { type CandleSource, candleTtlMs, createTtlCache } from "@app/market-data";
import { NANOS, type MarketBackend, SEED_UNIVERSE } from "./backend";
import { createLiveHub } from "./liveHub";

const OVERVIEW_TTL_MS = 60_000;
const UNIVERSE_TTL_MS = 6 * 3_600_000;
const LIVE_POLL_MS = 15_000;

export interface DirectDeps {
  readonly sources: readonly MarketSource[];
  readonly fx: FxSource;
  readonly candleSource: CandleSource;
  /** Loads the universe (exchange catalogs in live mode, a fixed list in fixture mode). */
  readonly universe: () => Promise<readonly UniverseAsset[]>;
}

/** No infrastructure (dev, e2e): fetch on demand with in-process caches. "Live" = overview polled every 15s. */
export function createDirectBackend(deps: DirectDeps): MarketBackend {
  const overviewCache = createTtlCache({ ttlMs: OVERVIEW_TTL_MS });
  const universeCache = createTtlCache({ ttlMs: UNIVERSE_TTL_MS });
  const assets = async (): Promise<readonly UniverseAsset[]> => {
    const universe = await universeCache.get("universe", deps.universe).catch(() => SEED_UNIVERSE);
    return universe.length > 0 ? universe : SEED_UNIVERSE;
  };
  const candleCaches = new Map<Timeframe, ReturnType<typeof createTtlCache>>();
  const cacheFor = (tf: Timeframe) => {
    const existing = candleCaches.get(tf) ?? createTtlCache({ ttlMs: candleTtlMs(tf) });
    candleCaches.set(tf, existing);
    return existing;
  };

  const backend: MarketBackend = {
    kind: "direct",
    assets,
    overview: () =>
      overviewCache.get("overview", async () => getMarketOverview({ sources: deps.sources, fx: deps.fx }, { symbols: (await assets()).map((a) => a.symbol) })),
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
      emit(assets.map((a) => ({ symbol: a.symbol, priceUsd: Number(a.priceUsdNanos) / NANOS, sources: a.sources.length, at: Date.now() })));
    };
    void push().catch(() => undefined);
    const timer = setInterval(() => void push().catch(() => undefined), LIVE_POLL_MS);
    return async () => clearInterval(timer);
  });

  return backend;
}
