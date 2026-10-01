import type { Bar, MarketOverview, Timeframe } from "@app/core";
import type { CandleRepo, LivePrice, MarketCache, QuoteRepo, StoredIndicators } from "@app/store";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runCandleSync } from "../src/jobs/candles";
import { runOverview } from "../src/jobs/overview";
import { RETENTION, runRetention } from "../src/jobs/retention";
import { startLivePrices } from "../src/realtime";
import { errorMessage, log } from "../src/log";
import { every } from "../src/scheduler";

const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const overview: MarketOverview = { assets: [], fx: { status: "failed" }, sources: [] };

function fakeCache(): MarketCache & { live: LivePrice[][]; indicators: StoredIndicators[] } {
  const live: LivePrice[][] = [];
  const indicators: StoredIndicators[] = [];
  return {
    live,
    indicators,
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
  });
});

describe("runCandleSync", () => {
  test("upserts each symbol, computes indicators from stored bars, isolates per-symbol failures", async () => {
    const cache = fakeCache();
    const stored = new Map<string, Bar[]>();
    const repo: CandleRepo = {
      upsert: vi.fn(async (symbol: string, _tf: Timeframe, _src: string, b: readonly Bar[]) => {
        stored.set(symbol, [...b]);
        return b.length;
      }),
      latest: vi.fn(async (symbol: string) => ({ source: "Coinbase", bars: stored.get(symbol) ?? [] })),
      prune: vi.fn(),
    };
    const source = {
      candles: vi.fn(async (symbol: string) => {
        if (symbol === "BAD") throw new Error("down");
        return { source: "Coinbase", bars: bars(30) };
      }),
    };
    const result = await runCandleSync({ symbols: ["BTC", "BAD", "ETH"], timeframe: "1h", source, repo, cache, now: () => new Date(0), log: silentLog, concurrency: 2 });
    expect(result).toEqual({ ok: 2, failed: ["BAD"] });
    expect(cache.indicators.map((i) => i.symbol).sort()).toEqual(["BTC", "ETH"]);
    expect(cache.indicators[0]?.snapshot.sma20).toBeCloseTo(119.5, 10);
    expect(cache.indicators[0]?.lastBarTime).toBe(29 * 3600);
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

describe("startLivePrices", () => {
  test("feeds ticks into the book and publishes changed medians on each flush", async () => {
    vi.useFakeTimers();
    const cache = fakeCache();
    const handlers: ((t: { symbol: string; source: string; price: number; at: number }[]) => void)[] = [];
    const live = startLivePrices({
      cache,
      streams: [0, 1].map(() => (onTicks: (t: { symbol: string; source: string; price: number; at: number }[]) => void) => {
        handlers.push(onTicks);
        return { stop: vi.fn() };
      }),
      flushMs: 1_000,
      maxTickAgeMs: 60_000,
      now: () => 1_000,
    });
    handlers[0]?.([{ symbol: "BTC", source: "Coinbase", price: 100, at: 900 }]);
    handlers[1]?.([{ symbol: "BTC", source: "Kraken", price: 102, at: 950 }]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cache.live).toEqual([[{ symbol: "BTC", priceUsd: 101, sources: 2, at: 950 }]]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cache.live).toHaveLength(1); // nothing new → nothing published
    live.stop();
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

describe("runCandleSync edge cases", () => {
  test("no stored bars → no indicators written", async () => {
    const cache = fakeCache();
    const repo = { upsert: vi.fn(async () => 0), latest: vi.fn(async () => ({ source: null, bars: [] })), prune: vi.fn() } as unknown as CandleRepo;
    const source = { candles: vi.fn(async () => ({ source: "Kraken", bars: [] })) };
    const result = await runCandleSync({ symbols: ["BTC"], timeframe: "1d", source, repo, cache, now: () => new Date(0), log: silentLog, concurrency: 3 });
    expect(result).toEqual({ ok: 1, failed: [] });
    expect(cache.indicators).toEqual([]);
  });
});
