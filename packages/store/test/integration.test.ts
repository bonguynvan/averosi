import type { IndicatorSnapshot, MarketOverview } from "@app/core";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createMarketCache, type LivePrice, type MarketCache } from "../src/cache";
import { createAssetRepo } from "../src/assetRepo";
import { createCandleRepo } from "../src/candleRepo";
import { type Sql, createSql, migrate } from "../src/db";
import { createQuoteRepo } from "../src/quoteRepo";

/**
 * Destructive tests (TRUNCATE / FLUSHDB) only ever run against dedicated test stores:
 * the database name must contain "test" and Redis must use logical DB 15.
 */
const DB_URL = process.env.TEST_DATABASE_URL && /\/[^/?]*test[^/?]*(\?|$)/.test(process.env.TEST_DATABASE_URL) ? process.env.TEST_DATABASE_URL : undefined;
const REDIS_URL = process.env.TEST_REDIS_URL && /\/15$/.test(process.env.TEST_REDIS_URL) ? process.env.TEST_REDIS_URL : undefined;

const bar = (time: number, close: number) => ({ time, open: close, high: close + 1, low: close - 1, close, volume: 10 });

const OVERVIEW: MarketOverview = {
  assets: [
    {
      symbol: "BTC",
      priceUsdMicros: 83_500_000_000n,
      change24hBps: 85,
      volume24hUsdMicros: 1_000_000_000n,
      sources: ["Coinbase", "Kraken"],
      maxDeviationBps: 4,
      priceVnd: 2_152_630_000n,
      volume24hVnd: 25_780_000n,
    },
  ],
  fx: { status: "ok", rateVnd: 25_780n, source: "Vietcombank (USD chuyển khoản)", fetchedAt: new Date("2026-10-01T08:00:00Z") },
  sources: [{ name: "Coinbase", status: "ok", fetchedAt: new Date("2026-10-01T08:00:00Z") }],
};

describe.skipIf(!DB_URL)("postgres repositories", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = createSql(DB_URL as string);
    await migrate(sql);
  });
  beforeEach(async () => {
    await sql`TRUNCATE candles, asset_quotes, fx_rates, assets`;
  });
  afterAll(async () => {
    await sql.end();
  });

  test("migrate is idempotent", async () => {
    expect(await migrate(sql)).toEqual([]);
  });

  test("assets: upsert universe; deactivate missing only when asked", async () => {
    const repo = createAssetRepo(sql);
    const btc = { symbol: "BTC", name: "Bitcoin", sources: ["Coinbase", "Kraken"], venues: { Coinbase: "BTC-USD", Kraken: "XBTUSD" } };
    const eth = { symbol: "ETH", name: "Ethereum", sources: ["Coinbase", "Kraken"], venues: { Coinbase: "ETH-USD", Kraken: "ETHUSD" } };
    expect(await repo.save([btc, eth], { deactivateMissing: true })).toEqual({ upserted: 2, deactivated: 0 });
    expect(await repo.save([btc], { deactivateMissing: false })).toEqual({ upserted: 1, deactivated: 0 });
    expect((await repo.active()).map((a) => a.symbol)).toEqual(["BTC", "ETH"]);
    expect(await repo.save([{ ...btc, name: "Bitcoin (BTC)" }], { deactivateMissing: true })).toEqual({ upserted: 1, deactivated: 1 });
    expect(await repo.active()).toEqual([{ ...btc, name: "Bitcoin (BTC)" }]);
    expect(await repo.save([], { deactivateMissing: true })).toEqual({ upserted: 0, deactivated: 0 });
    expect(await repo.save([eth], { deactivateMissing: false })).toEqual({ upserted: 1, deactivated: 0 });
    expect((await repo.active()).map((a) => a.symbol)).toEqual(["BTC", "ETH"]);
  });

  test("candles: upsert overwrites the forming bucket; latest is ascending and limited", async () => {
    const repo = createCandleRepo(sql);
    await repo.upsert("BTC", "1h", "Coinbase", [bar(3600, 100), bar(7200, 101), bar(10800, 102)]);
    await repo.upsert("BTC", "1h", "Kraken", [bar(10800, 105)]);
    const { source, bars } = await repo.latest("BTC", "1h", 2);
    expect(bars.map((b) => [b.time, b.close])).toEqual([
      [7200, 101],
      [10800, 105],
    ]);
    expect(source).toBe("Kraken");
    expect(await repo.upsert("BTC", "1h", "x", [])).toBe(0);
    expect((await repo.latest("ETH", "1h", 5)).bars).toEqual([]);
  });

  test("candles: prune by timeframe and age", async () => {
    const repo = createCandleRepo(sql);
    await repo.upsert("BTC", "1m", "Coinbase", [bar(60, 1), bar(120, 2)]);
    await repo.upsert("BTC", "1h", "Coinbase", [bar(60, 1)]);
    expect(await repo.prune("1m", new Date(200_000))).toBe(2); // bars at 60s and 120s
    expect((await repo.latest("BTC", "1h", 5)).bars).toHaveLength(1);
  });

  test("quotes: record snapshot and read history; FX stored", async () => {
    const repo = createQuoteRepo(sql);
    await repo.record(OVERVIEW, new Date("2026-10-01T08:00:00Z"));
    await repo.record(OVERVIEW, new Date("2026-10-01T08:00:00Z")); // duplicate ignored
    const history = await repo.history("BTC", new Date("2026-09-30T00:00:00Z"));
    expect(history).toEqual([{ takenAt: new Date("2026-10-01T08:00:00Z"), priceUsdMicros: 83_500_000_000n }]);
    const [fx] = await sql<{ vnd_per_usd: string }[]>`SELECT vnd_per_usd FROM fx_rates`;
    expect(fx?.vnd_per_usd).toBe("25780");
    expect(await repo.prune(new Date("2027-01-01T00:00:00Z"))).toBe(1);
  });
});

describe.skipIf(!REDIS_URL)("redis cache", () => {
  let cache: MarketCache;

  beforeAll(async () => {
    const admin = new Redis(REDIS_URL as string);
    await admin.flushdb();
    admin.disconnect();
    cache = createMarketCache(REDIS_URL as string);
  });
  afterAll(async () => {
    await cache.close();
  });

  test("overview round-trips with bigint and dates intact", async () => {
    const at = new Date("2026-10-01T08:00:15Z");
    await cache.setOverview(OVERVIEW, at);
    expect(await cache.getOverview()).toEqual({ overview: OVERVIEW, at });
  });

  test("indicators are stored per symbol and timeframe", async () => {
    const snapshot = { close: 1, rsi14: 50 } as unknown as IndicatorSnapshot;
    const value = { symbol: "ETH", timeframe: "1h" as const, computedAt: new Date(0), lastBarTime: 3600, snapshot };
    await cache.setIndicators(value);
    expect(await cache.getIndicators("ETH", "1h")).toEqual(value);
    expect(await cache.getIndicators("ETH", "1d")).toBeNull();
  });

  test("rank, demand and the dirty-indicator set (shared with the Go ingestor)", async () => {
    await cache.setRank(["BTC", "ETH"]);
    const admin = new Redis(REDIS_URL as string);
    expect(JSON.parse((await admin.get("market:rank")) ?? "null")).toEqual(["BTC", "ETH"]);
    await cache.markDemand("SOL", new Date(1_000));
    expect(await admin.zscore("market:demand", "SOL")).toBe("1000");
    await admin.sadd("ta:dirty", "BTC|1h", "bad-entry");
    expect(await cache.takeDirty(10)).toEqual([{ symbol: "BTC", timeframe: "1h" }]);
    expect(await cache.takeDirty(10)).toEqual([]);
    admin.disconnect();
  });

  test("live prices are delivered to subscribers", async () => {
    const received: LivePrice[][] = [];
    const unsubscribe = await cache.subscribeLive((p) => received.push(p));
    const prices = [{ symbol: "BTC", priceUsd: 83_500.5, sources: 2, at: 1 }];
    await cache.publishLive(prices);
    await expect.poll(() => received.length).toBe(1);
    expect(received[0]).toEqual(prices);
    await unsubscribe();
  });
});
