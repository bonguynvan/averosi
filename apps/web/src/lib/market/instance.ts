import "server-only";
import { MARKET_ASSETS, type MarketOverview, type Timeframe } from "@app/core";
import {
  type CandleResult,
  createBitstampSource,
  createCandleSource,
  createCoinbaseSource,
  createGeminiSource,
  createKrakenSource,
  createVietcombankFx,
} from "@app/market-data";
import { z } from "zod";
import { createRateLimiter } from "../risk/rateLimit";
import type { IndicatorsResult, MarketBackend } from "./backend";
import { createDirectBackend } from "./directBackend";
import { FIXTURE_CANDLES, FIXTURE_FX, FIXTURE_MARKET_SOURCES } from "./fixtures";
import type { LiveListener } from "./liveHub";
import { createStoreBackend } from "./storeBackend";

const FX_TTL_MS = 30 * 60_000;
const SYMBOLS = MARKET_ASSETS.map((a) => a.symbol);

/** Sources shown in the methodology panel; order = display order. */
export const MARKET_SOURCE_NOTES = [
  { name: "Coinbase", note: "Mỹ · cặp USD" },
  { name: "Kraken", note: "Mỹ/EU · cặp USD" },
  { name: "Bitstamp", note: "Luxembourg · cặp USD" },
  { name: "Gemini", note: "Mỹ · cặp USD" },
] as const;

const Env = z.object({
  DATA_MODE: z.enum(["live", "fixture"]).default("live"),
  MARKET_BACKEND: z.enum(["direct", "store"]).default("direct"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

function createBackend(): MarketBackend {
  const env = Env.parse({
    DATA_MODE: process.env.DATA_MODE || undefined,
    MARKET_BACKEND: process.env.MARKET_BACKEND || undefined,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
  });
  if (env.DATA_MODE === "fixture") {
    return createDirectBackend({ sources: FIXTURE_MARKET_SOURCES, fx: FIXTURE_FX, candleSource: FIXTURE_CANDLES, symbols: SYMBOLS });
  }
  if (env.MARKET_BACKEND === "store") {
    if (!env.DATABASE_URL || !env.REDIS_URL) throw new Error("MARKET_BACKEND=store requires DATABASE_URL and REDIS_URL");
    return createStoreBackend({ databaseUrl: env.DATABASE_URL, redisUrl: env.REDIS_URL });
  }
  return createDirectBackend({
    sources: [createCoinbaseSource(), createKrakenSource(), createBitstampSource(), createGeminiSource()],
    fx: createVietcombankFx({ ttlMs: FX_TTL_MS }),
    candleSource: createCandleSource(),
    symbols: SYMBOLS,
  });
}

let backend: MarketBackend | null = null;
/** Created on first use so builds never open connections. */
const current = () => (backend ??= createBackend());

export const marketOverview = (): Promise<MarketOverview> => current().overview();
export const candles = (symbol: string, timeframe: Timeframe): Promise<CandleResult> => current().candles(symbol, timeframe);
export const indicators = (symbol: string, timeframe: Timeframe): Promise<IndicatorsResult | null> => current().indicators(symbol, timeframe);
export const subscribeLive = (listener: LiveListener) => current().subscribeLive(listener);
export const backendKind = () => current().kind;

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
/** Realtime streams per client (tabs). */
export const MAX_LIVE_STREAMS_PER_CLIENT = 4;
