import "server-only";
import { createTtlCache } from "@app/market-data";
import { createAssetRepo, createCandleRepo, createMarketCache, createSql } from "@app/store";
import { EMPTY_OVERVIEW, type MarketBackend, SEED_UNIVERSE } from "./backend";
import { createLiveHub } from "./liveHub";

const CANDLE_LIMIT = 300;
const ASSETS_TTL_MS = 5 * 60_000;
/** At most one demand signal per symbol per process in this window. */
const DEMAND_THROTTLE_MS = 30_000;

/**
 * Read-only view of what apps/worker and services/ingestor write. Connections are opened lazily (never at
 * build time). Missing data is reported as empty/unavailable — never back-filled by calling exchanges.
 * The only write is a demand signal (symbol + time, no visitor data) so the ingestor refreshes the
 * intraday candles of an asset someone is looking at.
 */
export function createStoreBackend(env: { databaseUrl: string; redisUrl: string }, now: () => number = Date.now): MarketBackend {
  let sql: ReturnType<typeof createSql> | null = null;
  let cache: ReturnType<typeof createMarketCache> | null = null;
  const db = () => (sql ??= createSql(env.databaseUrl));
  const redis = () => (cache ??= createMarketCache(env.redisUrl));
  const assetsCache = createTtlCache({ ttlMs: ASSETS_TTL_MS });
  const lastDemand = new Map<string, number>();

  const signalDemand = (symbol: string) => {
    const at = now();
    if (at - (lastDemand.get(symbol) ?? 0) < DEMAND_THROTTLE_MS) return;
    lastDemand.set(symbol, at);
    void redis()
      .markDemand(symbol, new Date(at))
      .catch(() => undefined);
  };

  const hub = createLiveHub((emit) => redis().subscribeLive(emit));

  return {
    kind: "store",
    async assets() {
      const active = await assetsCache.get("assets", () => createAssetRepo(db()).active());
      return active.length > 0 ? active : SEED_UNIVERSE;
    },
    async overview() {
      return (await redis().getOverview())?.overview ?? EMPTY_OVERVIEW;
    },
    async candles(symbol, timeframe) {
      signalDemand(symbol);
      const { source, bars } = await createCandleRepo(db()).latest(symbol, timeframe, CANDLE_LIMIT);
      if (bars.length === 0 || source === null) throw new Error(`No stored candles for ${symbol} ${timeframe}`);
      return { source, bars };
    },
    indicators: (symbol, timeframe) => redis().getIndicators(symbol, timeframe),
    subscribeLive: (listener) => hub.subscribe(listener),
  };
}
