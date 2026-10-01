import { type Timeframe, indicatorSnapshot, parseTimeframe } from "@app/core";
import type { CandleRepo, MarketCache } from "@app/store";
import { type Log, errorMessage } from "../log";

/** Bars used for indicators: enough for SMA200 on the stored series. */
export const INDICATOR_WINDOW = 300;

export interface IndicatorJobDeps {
  readonly repo: CandleRepo;
  readonly cache: MarketCache;
  readonly now: () => Date;
  readonly log: Pick<Log, "warn">;
  /** Max (symbol, timeframe) pairs per run. */
  readonly batch: number;
}

async function computeOne(symbol: string, timeframe: Timeframe, deps: IndicatorJobDeps): Promise<boolean> {
  const { bars } = await deps.repo.latest(symbol, timeframe, INDICATOR_WINDOW);
  const last = bars.at(-1);
  if (!last) return false;
  await deps.cache.setIndicators({ symbol, timeframe, computedAt: deps.now(), lastBarTime: last.time, snapshot: indicatorSnapshot(bars) });
  return true;
}

/**
 * Recomputes indicators for candles the ingestor marked dirty. Pure TA stays in @app/core (one
 * implementation, unit-tested); the Go ingestor only signals which series changed.
 */
export async function runIndicators(deps: IndicatorJobDeps): Promise<{ computed: number; failed: number }> {
  const dirty = await deps.cache.takeDirty(deps.batch);
  let computed = 0;
  let failed = 0;
  for (const { symbol, timeframe: raw } of dirty) {
    const timeframe = parseTimeframe(raw);
    if (!timeframe) continue;
    try {
      if (await computeOne(symbol, timeframe, deps)) computed += 1;
    } catch (error) {
      failed += 1;
      deps.log.warn("indicator failed", { symbol, timeframe, error: errorMessage(error) });
    }
  }
  return { computed, failed };
}
