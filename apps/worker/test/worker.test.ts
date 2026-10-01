import type { Bar, MarketAsset, MarketOverview } from "@app/core";
import type { ListingSource } from "@app/market-data";
import type { AssetRepo, CandleRepo, LivePrice, MarketCache, QuoteRepo, StoredIndicators } from "@app/store";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runIndicators } from "../src/jobs/indicators";
import { runOverview } from "../src/jobs/overview";
import { RETENTION, runRetention } from "../src/jobs/retention";
import { runUniverse } from "../src/jobs/universe";
import { errorMessage, log } from "../src/log";
import { every } from "../src/scheduler";

const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const overview: MarketOverview = { assets: [], fx: { status: "failed" }, sources: [] };

function fakeCache(dirty: string[] = []): MarketCache & { live: LivePrice[][]; indicators: StoredIndicators[]; rank: string[][] } {
  const live: LivePrice[][] = [];
  const indicators: StoredIndicators[] = [];
  const rank: string[][] = [];
  return {
    live,
    indicators,
    rank,
    setRank: vi.fn(async (s) => void rank.push([...s])),
    markDemand: vi.fn(async () => undefined),
    takeDirty: vi.fn(async (n: number) =>
      dirty.splice(0, n).map((d) => {
        const [symbol = "", timeframe = ""] = d.split("|");
        return { symbol, timeframe };
      }),
    ),
    setOverview: vi.fn(async () => undefined),
    getOverview: vi.fn(async () => null),
    setIndicators: vi.fn(async (v) => void indicators.push(v)),
    getIndicators: vi.fn(async () => null),
    publishLive: vi.fn(async (p) => void live.push([...p])),
    subscribeLive: vi.fn(async () => async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

const bars = (n: number): Bar[] => Array.from({ length: n }, (_, i) => ({ time: i * 3600, open: 1, high: 2, low: 0.5, close: 100 + i, volume: 1 }));

afterEach(() => vi.useRealTimers());

describe("every (scheduler)", () => {
  test("runs immediately and on interval, never overlapping, logs failures, stops", async () => {
    vi.useFakeTimers();
    let running = 0;
    let maxConcurrent = 0;
    let calls = 0;
    const job = every("job", 1_000, async () => {
      calls += 1;
      running += 1;
      maxConcurrent = Math.max(maxConcurrent, running);
      await new Promise((r) => setTimeout(r, 2_500)); // slower than the interval
      running -= 1;
      if (calls === 2) throw new Error("boom");
    }, silentLog);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(maxConcurrent).toBe(1);
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(silentLog.error).toHaveBeenCalledWith("job failed", expect.objectContaining({ job: "job", error: "boom" }));
    job.stop();
    const after = calls;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBeLessThanOrEqual(after + 1);
  });
});

describe("runOverview", () => {
  test("caches every run and records history only on the configured cadence", async () => {
    const cache = fakeCache();
    const quotes: QuoteRepo = { record: vi.fn(async () => undefined), history: vi.fn(), prune: vi.fn() };
    const load = vi.fn(async () => overview);
    await runOverview({ load, cache, quotes, now: () => new Date("2026-10-01T08:00:15Z"), recordEverySeconds: 60 });
    expect(cache.setOverview).toHaveBeenCalledWith(overview, new Date("2026-10-01T08:00:15Z"));
    expect(quotes.record).not.toHaveBeenCalled();
    await runOverview({ load, cache, quotes, now: () => new Date("2026-10-01T08:01:00Z"), recordEverySeconds: 60 });
    expect(quotes.record).toHaveBeenCalledTimes(1);
    expect(cache.rank).toEqual([]); // empty overview → rank untouched
  });

  test("publishes symbols ranked by 24h volume for the ingestor", async () => {
    const cache = fakeCache();
    const asset = (symbol: string, volume: bigint) => ({ symbol, volume24hUsdNanos: volume, change24hBps: 0 }) as unknown as MarketAsset;
    const quotes = { record: vi.fn(async () => undefined) } as unknown as QuoteRepo;
    const load = async () => ({ ...overview, assets: [asset("ETH", 5n), asset("BTC", 9n), asset("XRP", 1n)] });
    expect(await runOverview({ load, cache, quotes, now: () => new Date("2026-10-01T08:00:20Z"), recordEverySeconds: 60 })).toEqual({ assets: 3 });
    expect(cache.rank).toEqual([["BTC", "ETH", "XRP"]]);
  });
});

describe("runUniverse", () => {
  const source = (name: string, symbols: string[] | Error): ListingSource => ({
    name,
    listings: async () => {
      if (symbols instanceof Error) throw symbols;
      return symbols.map((symbol) => ({ source: name, symbol, venueId: `${symbol}-${name}` }));
    },
  });
  const repo = (): AssetRepo & { saved: { symbols: string[]; deactivateMissing: boolean }[] } => {
    const saved: { symbols: string[]; deactivateMissing: boolean }[] = [];
    return {
      saved,
      save: vi.fn(async (u: Parameters<AssetRepo["save"]>[0], opts: Parameters<AssetRepo["save"]>[1]) => {
        saved.push({ symbols: u.map((a) => a.symbol), deactivateMissing: opts.deactivateMissing });
        return { upserted: u.length, deactivated: 0 };
      }),
      active: vi.fn(async () => []),
    };
  };

  test("keeps assets on ≥ minSources exchanges, excludes stablecoins, deactivates only after a clean read", async () => {
    const r = repo();
    const result = await runUniverse({ sources: [source("A", ["BTC", "USDT", "ETH"]), source("B", ["BTC", "USDT", "SOL"])], repo: r, minSources: 2 });
    expect(result).toEqual({ assets: 1, upserted: 1, deactivated: 0, failedCatalogs: [] });
    expect(r.saved).toEqual([{ symbols: ["BTC"], deactivateMissing: true }]);
  });

  test("a failed catalog never deactivates; all failed throws", async () => {
    const r = repo();
    const result = await runUniverse({ sources: [source("A", ["BTC"]), source("B", ["BTC"]), source("C", new Error("down"))], repo: r, minSources: 2 });
    expect(result.failedCatalogs).toEqual(["C"]);
    expect(r.saved[0]?.deactivateMissing).toBe(false);
    await expect(runUniverse({ sources: [source("C", new Error("down"))], repo: r, minSources: 1 })).rejects.toThrow("all exchange catalogs failed");
  });
});

describe("runIndicators", () => {
  test("recomputes indicators for dirty series from stored bars; isolates failures; skips bad timeframes", async () => {
    const cache = fakeCache(["BTC|1h", "BAD|1h", "ETH|1h", "BTC|2h", "NONE|1d"]);
    const repo = {
      upsert: vi.fn(),
      prune: vi.fn(),
      latest: vi.fn(async (symbol: string) => {
        if (symbol === "BAD") throw new Error("db down");
        return { source: "Coinbase", bars: symbol === "NONE" ? [] : bars(30) };
      }),
    } as unknown as CandleRepo;
    const result = await runIndicators({ repo, cache, now: () => new Date(0), log: silentLog, batch: 10 });
    expect(result).toEqual({ computed: 2, failed: 1 });
    expect(cache.indicators.map((i) => i.symbol)).toEqual(["BTC", "ETH"]);
    expect(cache.indicators[0]?.snapshot.sma20).toBeCloseTo(119.5, 10);
    expect(cache.indicators[0]?.lastBarTime).toBe(29 * 3600);
    expect(silentLog.warn).toHaveBeenCalledWith("indicator failed", expect.objectContaining({ symbol: "BAD" }));
  });

  test("respects the batch size", async () => {
    const cache = fakeCache(["A|1h", "B|1h", "C|1h"]);
    const repo = { latest: vi.fn(async () => ({ source: "x", bars: bars(5) })) } as unknown as CandleRepo;
    expect(await runIndicators({ repo, cache, now: () => new Date(0), log: silentLog, batch: 2 })).toEqual({ computed: 2, failed: 0 });
  });
});

describe("runRetention", () => {
  test("prunes each timeframe and quote history by its retention window", async () => {
    const repo = { upsert: vi.fn(), latest: vi.fn(), prune: vi.fn(async () => 3) } as unknown as CandleRepo;
    const quotes = { record: vi.fn(), history: vi.fn(), prune: vi.fn(async () => 5) } as unknown as QuoteRepo;
    const now = new Date("2026-10-31T00:00:00Z");
    const result = await runRetention({ candles: repo, quotes, now: () => now });
    expect(repo.prune).toHaveBeenCalledWith("1m", new Date(now.getTime() - RETENTION.candles["1m"]));
    expect(repo.prune).not.toHaveBeenCalledWith("1d", expect.anything()); // daily candles kept
    expect(result.quotes).toBe(5);
  });
});

describe("log", () => {
  test("writes JSON lines with level and fields; errorMessage handles non-Errors", () => {
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log.info("hello", { a: 1 });
    log.warn("careful");
    log.error("bad", { job: "x" });
    expect(JSON.parse(String(out.mock.calls[0]?.[0]))).toMatchObject({ level: "info", message: "hello", a: 1 });
    expect(JSON.parse(String(err.mock.calls[1]?.[0]))).toMatchObject({ level: "error", job: "x" });
    expect(errorMessage("plain")).toBe("plain");
    out.mockRestore();
    err.mockRestore();
  });
});

describe("scheduler edge cases", () => {
  test("stop() during the first run prevents any reschedule", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const job = every("x", 100, async () => {
      calls += 1;
    }, silentLog);
    job.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(1);
  });
});
