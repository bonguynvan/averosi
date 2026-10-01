import "server-only";
import { createCandleRepo, createMarketCache, createSql } from "@app/store";
import { EMPTY_OVERVIEW, type MarketBackend } from "./backend";
import { createLiveHub } from "./liveHub";

const CANDLE_LIMIT = 300;

/**
 * Read-only view of what apps/worker writes. Connections are opened lazily (never at build time).
 * Missing data is reported as empty/unavailable — never back-filled by calling exchanges from here.
 */
export function createStoreBackend(env: { databaseUrl: string; redisUrl: string }): MarketBackend {
  let sql: ReturnType<typeof createSql> | null = null;
  let cache: ReturnType<typeof createMarketCache> | null = null;
  const db = () => (sql ??= createSql(env.databaseUrl));
  const redis = () => (cache ??= createMarketCache(env.redisUrl));

  const hub = createLiveHub((emit) => redis().subscribeLive(emit));

  return {
    kind: "store",
    async overview() {
      return (await redis().getOverview())?.overview ?? EMPTY_OVERVIEW;
    },
    async candles(symbol, timeframe) {
      const { source, bars } = await createCandleRepo(db()).latest(symbol, timeframe, CANDLE_LIMIT);
      if (bars.length === 0 || source === null) throw new Error(`No stored candles for ${symbol} ${timeframe}`);
      return { source, bars };
    },
    indicators: (symbol, timeframe) => redis().getIndicators(symbol, timeframe),
    subscribeLive: (listener) => hub.subscribe(listener),
  };
}
