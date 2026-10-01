import type { IndicatorSnapshot, MarketOverview, Timeframe } from "@app/core";
import { Redis } from "ioredis";
import { decode, encode } from "./codec";

/**
 * Redis key/channel names in one place. Shared with services/ingestor (Go): keep both in sync.
 * - rank: JSON array of symbols by 24h volume (worker → ingestor: which assets are "hot").
 * - demand: sorted set symbol → last request (unix ms) (web → ingestor: someone is viewing it).
 * - taDirty: set of "SYMBOL|TF" whose candles changed (ingestor → worker: recompute indicators).
 */
export const KEYS = {
  overview: "market:overview",
  indicators: (symbol: string, tf: Timeframe) => `ta:${symbol}:${tf}`,
  liveChannel: "market:live",
  rank: "market:rank",
  demand: "market:demand",
  taDirty: "ta:dirty",
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
  setRank(symbols: readonly string[]): Promise<void>;
  /** Records that a symbol is being viewed (no visitor data: symbol and time only). */
  markDemand(symbol: string, at: Date): Promise<void>;
  /** Removes and returns up to `count` dirty "SYMBOL|TF" entries. */
  takeDirty(count: number): Promise<{ symbol: string; timeframe: string }[]>;
  /** Subscribes on a dedicated connection; returns an unsubscribe function. */
  subscribeLive(onPrices: (prices: LivePrice[]) => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

const OVERVIEW_TTL_S = 15 * 60; // stale data expires instead of being served forever
const INDICATORS_TTL_S = 24 * 3600;
const RANK_TTL_S = 3600;

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
    async setRank(symbols) {
      await redis.set(KEYS.rank, JSON.stringify(symbols), "EX", RANK_TTL_S);
    },
    async markDemand(symbol, at) {
      await redis.zadd(KEYS.demand, at.getTime(), symbol);
    },
    async takeDirty(count) {
      const members = await redis.spop(KEYS.taDirty, count);
      return members.flatMap((m) => {
        const [symbol, timeframe] = m.split("|");
        return symbol && timeframe ? [{ symbol, timeframe }] : [];
      });
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
