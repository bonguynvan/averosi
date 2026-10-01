import { type Timeframe, indicatorSnapshot } from "@app/core";
import type { CandleSource } from "@app/market-data";
import type { CandleRepo, MarketCache } from "@app/store";
import { type Log, errorMessage } from "../log";

/** Bars used for indicators: enough for SMA200 on the stored series. */
const INDICATOR_WINDOW = 300;

export interface CandleSyncDeps {
  readonly symbols: readonly string[];
  readonly timeframe: Timeframe;
  readonly source: CandleSource;
  readonly repo: CandleRepo;
  readonly cache: MarketCache;
  readonly now: () => Date;
  readonly log: Pick<Log, "warn">;
  readonly concurrency: number;
}

async function syncOne(symbol: string, deps: CandleSyncDeps): Promise<void> {
  const { source, bars } = await deps.source.candles(symbol, deps.timeframe);
  await deps.repo.upsert(symbol, deps.timeframe, source, bars);
  const stored = await deps.repo.latest(symbol, deps.timeframe, INDICATOR_WINDOW);
  const last = stored.bars.at(-1);
  if (!last) return;
  await deps.cache.setIndicators({
    symbol,
    timeframe: deps.timeframe,
    computedAt: deps.now(),
    lastBarTime: last.time,
    snapshot: indicatorSnapshot(stored.bars),
  });
}

/** Fetches recent candles for every symbol (bounded concurrency), upserts them, refreshes indicators. */
export async function runCandleSync(deps: CandleSyncDeps): Promise<{ ok: number; failed: string[] }> {
  const failed: string[] = [];
  let ok = 0;
  for (let i = 0; i < deps.symbols.length; i += deps.concurrency) {
    const batch = deps.symbols.slice(i, i + deps.concurrency);
    const results = await Promise.allSettled(batch.map((s) => syncOne(s, deps)));
    results.forEach((r, j) => {
      const symbol = batch[j] as string;
      if (r.status === "fulfilled") ok += 1;
      else {
        failed.push(symbol);
        deps.log.warn("candle sync failed", { symbol, timeframe: deps.timeframe, error: errorMessage(r.reason) });
      }
    });
  }
  return { ok, failed };
}
