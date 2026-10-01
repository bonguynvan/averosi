import "server-only";
import { MARKET_ASSETS, type MarketOverview, type Timeframe, getMarketOverview } from "@app/core";
import {
  type CandleResult,
  candleTtlMs,
  createBitstampSource,
  createCandleSource,
  createCoinbaseSource,
  createGeminiSource,
  createKrakenSource,
  createTtlCache,
  createVietcombankFx,
} from "@app/market-data";
import { createRateLimiter } from "../risk/rateLimit";
import { FIXTURE_CANDLES, FIXTURE_FX, FIXTURE_MARKET_SOURCES } from "./fixtures";

const OVERVIEW_TTL_MS = 60_000;
const FX_TTL_MS = 30 * 60_000;

const isFixture = process.env.DATA_MODE === "fixture";

/** Sources shown in the methodology panel; order = display order. */
export const MARKET_SOURCE_NOTES = [
  { name: "Coinbase", note: "Mỹ · cặp USD" },
  { name: "Kraken", note: "Mỹ/EU · cặp USD" },
  { name: "Bitstamp", note: "Luxembourg · cặp USD" },
  { name: "Gemini", note: "Mỹ · cặp USD" },
] as const;

const deps = isFixture
  ? { sources: FIXTURE_MARKET_SOURCES, fx: FIXTURE_FX }
  : {
      sources: [createCoinbaseSource(), createKrakenSource(), createBitstampSource(), createGeminiSource()],
      fx: createVietcombankFx({ ttlMs: FX_TTL_MS }),
    };
const candleSource = isFixture ? FIXTURE_CANDLES : createCandleSource();

const overviewCache = createTtlCache({ ttlMs: OVERVIEW_TTL_MS });
const candleCaches = new Map<Timeframe, ReturnType<typeof createTtlCache>>();
const candleCacheFor = (tf: Timeframe) => {
  const existing = candleCaches.get(tf);
  if (existing) return existing;
  const cache = createTtlCache({ ttlMs: candleTtlMs(tf) });
  candleCaches.set(tf, cache);
  return cache;
};
const SYMBOLS = MARKET_ASSETS.map((a) => a.symbol);

export function marketOverview(): Promise<MarketOverview> {
  return overviewCache.get("overview", () => getMarketOverview(deps, { symbols: SYMBOLS }));
}

export function candles(symbol: string, timeframe: Timeframe): Promise<CandleResult> {
  return candleCacheFor(timeframe).get(symbol, () => candleSource.candles(symbol, timeframe));
}

const SPARKLINE_POINTS = 24;

/** Last 24 hourly closes per symbol for landing sparklines. Symbols whose candles fail are omitted. */
export async function sparklineSeries(symbols: readonly string[]): Promise<Readonly<Record<string, readonly number[]>>> {
  const results = await Promise.allSettled(symbols.map((s) => candles(s, "1h")));
  return Object.fromEntries(
    symbols.flatMap((symbol, i) => {
      const r = results[i];
      return r?.status === "fulfilled" ? [[symbol, r.value.bars.slice(-SPARKLINE_POINTS).map((b) => b.close)]] : [];
    }),
  );
}

/** 90 candle requests per minute per client: room for the full chart page polling plus its watchlist. */
export const candleRateLimiter = createRateLimiter({ limit: 90, windowMs: 60_000 });
