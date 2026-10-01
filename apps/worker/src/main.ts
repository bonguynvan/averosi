import { MARKET_ASSETS, getMarketOverview } from "@app/core";
import {
  createBitstampSource,
  createCoinbaseSource,
  createGeminiSource,
  createKrakenSource,
  createListingSources,
  createVietcombankFx,
} from "@app/market-data";
import { createAssetRepo, createCandleRepo, createMarketCache, createQuoteRepo, createSql, migrate } from "@app/store";
import { z } from "zod";
import { runIndicators } from "./jobs/indicators";
import { runOverview } from "./jobs/overview";
import { runRetention } from "./jobs/retention";
import { runUniverse } from "./jobs/universe";
import { errorMessage, log } from "./log";
import { every } from "./scheduler";

/**
 * TypeScript worker: asset universe, aggregated overview, indicators (pure TA from @app/core) and
 * retention. Candles and realtime prices are ingested by services/ingestor (Go) into the same stores.
 */
const Env = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  UNIVERSE_MIN_SOURCES: z.coerce.number().int().min(1).max(4).default(2),
});

const UNIVERSE_INTERVAL_MS = 24 * 3_600_000;
const OVERVIEW_INTERVAL_MS = 15_000;
const INDICATORS_INTERVAL_MS = 10_000;
const INDICATORS_BATCH = 500;
const RETENTION_INTERVAL_MS = 24 * 3_600_000;
const FX_TTL_MS = 30 * 60_000;

async function main(): Promise<void> {
  const env = Env.parse({ ...process.env, UNIVERSE_MIN_SOURCES: process.env.UNIVERSE_MIN_SOURCES || undefined });
  const sql = createSql(env.DATABASE_URL);
  const applied = await migrate(sql);
  log.info("migrations", { applied });

  const cache = createMarketCache(env.REDIS_URL);
  const assets = createAssetRepo(sql);
  const candles = createCandleRepo(sql);
  const quotes = createQuoteRepo(sql);
  const marketDeps = {
    sources: [createCoinbaseSource(), createKrakenSource(), createBitstampSource(), createGeminiSource()],
    fx: createVietcombankFx({ ttlMs: FX_TTL_MS }),
  };
  const now = () => new Date();
  // Until the first universe run has stored anything, fall back to the seed list.
  const symbols = async () => {
    const active = await assets.active();
    return (active.length > 0 ? active : MARKET_ASSETS).map((a) => a.symbol);
  };

  const jobs = [
    every("universe", UNIVERSE_INTERVAL_MS, async () => log.info("universe", { ...(await runUniverse({ sources: createListingSources(), repo: assets, minSources: env.UNIVERSE_MIN_SOURCES })) }), log),
    every("overview", OVERVIEW_INTERVAL_MS, async () => {
      const list = await symbols();
      await runOverview({ load: () => getMarketOverview(marketDeps, { symbols: list }), cache, quotes, now, recordEverySeconds: 60 });
    }, log),
    every("indicators", INDICATORS_INTERVAL_MS, async () => {
      const result = await runIndicators({ repo: candles, cache, now, log, batch: INDICATORS_BATCH });
      if (result.failed > 0) log.warn("indicators partial", result);
    }, log),
    every("retention", RETENTION_INTERVAL_MS, async () => log.info("retention", await runRetention({ candles, quotes, now })), log),
  ];

  log.info("worker started", { minSources: env.UNIVERSE_MIN_SOURCES });

  const shutdown = async (signal: string) => {
    log.info("shutting down", { signal });
    jobs.forEach((j) => j.stop());
    await cache.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((e: unknown) => {
  log.error("worker failed to start", { error: errorMessage(e) });
  process.exit(1);
});
