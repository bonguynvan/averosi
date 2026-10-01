import { CANDLE_TIMEFRAMES, MARKET_ASSETS, type Timeframe, getMarketOverview } from "@app/core";
import {
  coinbaseSubscribe,
  createBitstampSource,
  createCandleSource,
  createCoinbaseSource,
  createGeminiSource,
  createKrakenSource,
  createTickerStream,
  createVietcombankFx,
  krakenSubscribe,
  parseCoinbaseTicker,
  parseKrakenTicker,
} from "@app/market-data";
import { createCandleRepo, createMarketCache, createQuoteRepo, createSql, migrate } from "@app/store";
import { z } from "zod";
import { runCandleSync } from "./jobs/candles";
import { runOverview } from "./jobs/overview";
import { runRetention } from "./jobs/retention";
import { errorMessage, log } from "./log";
import { startLivePrices } from "./realtime";
import { every } from "./scheduler";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REALTIME: z.enum(["on", "off"]).default("on"),
});

/** How often each timeframe is refreshed: often for intraday, rarely for daily candles. */
const CANDLE_INTERVAL_MS: Record<Timeframe, number> = { "1m": 20_000, "5m": 60_000, "15m": 120_000, "1h": 300_000, "1d": 1_800_000 };
const OVERVIEW_INTERVAL_MS = 15_000;
const RETENTION_INTERVAL_MS = 24 * 3_600_000;
const FX_TTL_MS = 30 * 60_000;

async function main(): Promise<void> {
  const env = Env.parse({ ...process.env, REALTIME: process.env.REALTIME || undefined });
  const sql = createSql(env.DATABASE_URL);
  const applied = await migrate(sql);
  log.info("migrations", { applied });

  const cache = createMarketCache(env.REDIS_URL);
  const candles = createCandleRepo(sql);
  const quotes = createQuoteRepo(sql);
  const symbols = MARKET_ASSETS.map((a) => a.symbol);
  const marketDeps = {
    sources: [createCoinbaseSource(), createKrakenSource(), createBitstampSource(), createGeminiSource()],
    fx: createVietcombankFx({ ttlMs: FX_TTL_MS }),
  };
  const candleSource = createCandleSource();
  const now = () => new Date();

  const jobs = [
    every("overview", OVERVIEW_INTERVAL_MS, () => runOverview({ load: () => getMarketOverview(marketDeps, { symbols }), cache, quotes, now, recordEverySeconds: 60 }), log),
    ...CANDLE_TIMEFRAMES.map((timeframe) =>
      every(`candles:${timeframe}`, CANDLE_INTERVAL_MS[timeframe], async () => {
        const result = await runCandleSync({ symbols, timeframe, source: candleSource, repo: candles, cache, now, log, concurrency: 3 });
        if (result.failed.length > 0) log.warn("candle sync partial", { timeframe, ...result });
      }, log),
    ),
    every("retention", RETENTION_INTERVAL_MS, async () => log.info("retention", await runRetention({ candles, quotes, now })), log),
  ];

  const live =
    env.REALTIME === "on"
      ? startLivePrices({
          cache,
          flushMs: 1_000,
          maxTickAgeMs: 60_000,
          now: Date.now,
          streams: [
            (onTicks) =>
              createTickerStream({ name: "Coinbase", url: "wss://ws-feed.exchange.coinbase.com", subscribe: coinbaseSubscribe(symbols), parse: parseCoinbaseTicker, onTicks, onStatus: (s) => log.info("stream", { source: "Coinbase", status: s }) }),
            (onTicks) =>
              createTickerStream({ name: "Kraken", url: "wss://ws.kraken.com/v2", subscribe: krakenSubscribe(symbols), parse: parseKrakenTicker, onTicks, onStatus: (s) => log.info("stream", { source: "Kraken", status: s }) }),
          ],
        })
      : null;

  log.info("worker started", { symbols: symbols.length, timeframes: CANDLE_TIMEFRAMES, realtime: env.REALTIME });

  const shutdown = async (signal: string) => {
    log.info("shutting down", { signal });
    jobs.forEach((j) => j.stop());
    live?.stop();
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
