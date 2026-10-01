import type { IndicatorSnapshot, MarketOverview, Timeframe } from "@app/core";
import { Redis } from "ioredis";
import { decode, encode } from "./codec";

/** Redis key/channel names in one place. */
export const KEYS = {
  overview: "market:overview",
  indicators: (symbol: string, tf: Timeframe) => `ta:${symbol}:${tf}`,
  liveChannel: "market:live",
} as const;

/** Realtime median price pushed by the worker (USD, display-grade number). */
export interface LivePrice {
  readonly symbol: string;
  readonly priceUsd: number;
  readonly sources: number;
  readonly at: number; // unix ms
}

export interface StoredIndicators {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly computedAt: Date;
  readonly lastBarTime: number;
  readonly snapshot: IndicatorSnapshot;
}

export interface MarketCache {
  setOverview(overview: MarketOverview, at: Date): Promise<void>;
  getOverview(): Promise<{ overview: MarketOverview; at: Date } | null>;
  setIndicators(value: StoredIndicators): Promise<void>;
  getIndicators(symbol: string, tf: Timeframe): Promise<StoredIndicators | null>;
  publishLive(prices: readonly LivePrice[]): Promise<void>;
  /** Subscribes on a dedicated connection; returns an unsubscribe function. */
  subscribeLive(onPrices: (prices: LivePrice[]) => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

const OVERVIEW_TTL_S = 15 * 60; // stale data expires instead of being served forever
const INDICATORS_TTL_S = 24 * 3600;

export function createMarketCache(url: string): MarketCache {
  const redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
  const subscribers: Redis[] = [];

  return {
    async setOverview(overview, at) {
      await redis.set(KEYS.overview, encode({ overview, at }), "EX", OVERVIEW_TTL_S);
    },
    async getOverview() {
      const raw = await redis.get(KEYS.overview);
      return raw ? decode<{ overview: MarketOverview; at: Date }>(raw) : null;
    },
    async setIndicators(value) {
      await redis.set(KEYS.indicators(value.symbol, value.timeframe), encode(value), "EX", INDICATORS_TTL_S);
    },
    async getIndicators(symbol, tf) {
      const raw = await redis.get(KEYS.indicators(symbol, tf));
      return raw ? decode<StoredIndicators>(raw) : null;
    },
    async publishLive(prices) {
      if (prices.length > 0) await redis.publish(KEYS.liveChannel, encode(prices));
    },
    async subscribeLive(onPrices) {
      const sub = redis.duplicate();
      subscribers.push(sub);
      sub.on("message", (_channel: string, message: string) => onPrices(decode<LivePrice[]>(message)));
      await sub.subscribe(KEYS.liveChannel);
      return async () => {
        await sub.unsubscribe(KEYS.liveChannel);
        sub.disconnect();
      };
    },
    async close() {
      subscribers.forEach((s) => s.disconnect());
      await redis.quit();
    },
  };
}
