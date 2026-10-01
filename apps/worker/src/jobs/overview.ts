import type { MarketOverview } from "@app/core";
import type { MarketCache, QuoteRepo } from "@app/store";

export interface OverviewJobDeps {
  readonly load: () => Promise<MarketOverview>;
  readonly cache: MarketCache;
  readonly quotes: QuoteRepo;
  readonly now: () => Date;
  /** Persist history when the run falls on this boundary (e.g. 60 → once per minute). */
  readonly recordEverySeconds: number;
}

/** Aggregates all sources, publishes the snapshot to Redis, and samples it into Postgres history. */
export async function runOverview(deps: OverviewJobDeps): Promise<void> {
  const overview = await deps.load();
  const at = deps.now();
  await deps.cache.setOverview(overview, at);
  if (Math.floor(at.getTime() / 1000) % deps.recordEverySeconds < 15) {
    await deps.quotes.record(overview, new Date(Math.floor(at.getTime() / (deps.recordEverySeconds * 1000)) * deps.recordEverySeconds * 1000));
  }
}
