import { type IndicatorSnapshot, MARKET_ASSETS, type MarketOverview, type Timeframe, type UniverseAsset } from "@app/core";
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
  /** The asset universe (discovered from exchange catalogs; the seed list until one exists). */
  assets(): Promise<readonly UniverseAsset[]>;
  overview(): Promise<MarketOverview>;
  candles(symbol: string, timeframe: Timeframe): Promise<CandleResult>;
  indicators(symbol: string, timeframe: Timeframe): Promise<IndicatorsResult | null>;
  subscribeLive(listener: LiveListener): Promise<() => Promise<void>>;
}

export const NANOS = 1_000_000_000;

export const EMPTY_OVERVIEW: MarketOverview = { assets: [], fx: { status: "failed" }, sources: [] };

/** Seed assets as a universe: used before discovery has run and in fixture mode. */
export const SEED_UNIVERSE: readonly UniverseAsset[] = MARKET_ASSETS.map((a) => ({ ...a, sources: [], venues: {} }));
