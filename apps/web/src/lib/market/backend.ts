import type { IndicatorSnapshot, MarketOverview, Timeframe } from "@app/core";
import type { CandleResult } from "@app/market-data";
import type { LiveListener } from "./liveHub";

export interface IndicatorsResult {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly computedAt: Date;
  readonly lastBarTime: number;
  readonly snapshot: IndicatorSnapshot;
}

/**
 * Where market data comes from:
 * - "direct": the web process calls exchanges itself (no infrastructure; dev and e2e).
 * - "store": the worker fills Postgres/Redis and the web only reads (production).
 */
export interface MarketBackend {
  readonly kind: "direct" | "store";
  overview(): Promise<MarketOverview>;
  candles(symbol: string, timeframe: Timeframe): Promise<CandleResult>;
  indicators(symbol: string, timeframe: Timeframe): Promise<IndicatorsResult | null>;
  subscribeLive(listener: LiveListener): Promise<() => Promise<void>>;
}

export const MICROS = 1_000_000;

export const EMPTY_OVERVIEW: MarketOverview = { assets: [], fx: { status: "failed" }, sources: [] };
