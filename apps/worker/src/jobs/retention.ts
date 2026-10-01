import type { Timeframe } from "@app/core";
import type { CandleRepo, QuoteRepo } from "@app/store";

const DAY = 86_400_000;

/** How long data is kept. Daily candles are kept indefinitely (small, useful for long-term analytics). */
export const RETENTION = {
  candles: { "1m": 7 * DAY, "5m": 30 * DAY, "15m": 90 * DAY, "1h": 730 * DAY } satisfies Partial<Record<Timeframe, number>>,
  quotes: 180 * DAY,
} as const;

export async function runRetention(deps: { candles: CandleRepo; quotes: QuoteRepo; now: () => Date }): Promise<{ candles: number; quotes: number }> {
  const now = deps.now().getTime();
  let candles = 0;
  for (const [tf, age] of Object.entries(RETENTION.candles) as [Timeframe, number][]) {
    candles += await deps.candles.prune(tf, new Date(now - age));
  }
  const quotes = await deps.quotes.prune(new Date(now - RETENTION.quotes));
  return { candles, quotes };
}
