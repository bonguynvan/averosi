import type { FxSource, MarketSource } from "@app/core";
import { sourced } from "@app/core";
import type { CandleSource } from "@app/market-data";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createDirectBackend } from "@/lib/market/directBackend";

const AT = new Date("2026-10-01T08:00:00Z");
const source: MarketSource = {
  name: "Fake",
  quotes: async (symbols) => sourced(symbols.map((s) => ({ source: "Fake", symbol: s, lastUsdMicros: 2_000_000n })), "Fake", AT),
};
const fx: FxSource = { usdVndRate: async () => sourced(25_000n, "FX", AT) };
const bars = Array.from({ length: 30 }, (_, i) => ({ time: i * 3600, open: 1, high: 2, low: 0.5, close: 10 + i, volume: 1 }));

afterEach(() => vi.useRealTimers());

describe("createDirectBackend", () => {
  test("overview, cached candles and on-demand indicators", async () => {
    const candleSource: CandleSource = { candles: vi.fn(async () => ({ source: "Fake", bars })) };
    const backend = createDirectBackend({ sources: [source], fx, candleSource, symbols: ["BTC"] });
    expect(backend.kind).toBe("direct");
    expect((await backend.overview()).assets[0]?.priceVnd).toBe(50_000n);

    await backend.candles("BTC", "1h");
    await backend.candles("BTC", "1h");
    expect(candleSource.candles).toHaveBeenCalledTimes(1); // cached

    const ind = await backend.indicators("BTC", "1h");
    expect(ind?.lastBarTime).toBe(29 * 3600);
    expect(ind?.snapshot.sma20).toBeCloseTo(29.5, 10);
  });

  test("no bars → no indicators", async () => {
    const backend = createDirectBackend({ sources: [source], fx, candleSource: { candles: async () => ({ source: "Fake", bars: [] }) }, symbols: ["BTC"] });
    expect(await backend.indicators("BTC", "1d")).toBeNull();
  });

  test("live: pushes overview prices immediately and every 15s while subscribed", async () => {
    vi.useFakeTimers();
    const backend = createDirectBackend({ sources: [source], fx, candleSource: { candles: async () => ({ source: "Fake", bars }) }, symbols: ["BTC"] });
    const received: unknown[] = [];
    const off = await backend.subscribeLive((p) => received.push(p));
    await vi.advanceTimersByTimeAsync(0);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual([expect.objectContaining({ symbol: "BTC", priceUsd: 2, sources: 1 })]);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(received).toHaveLength(2);
    await off();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(received).toHaveLength(2);
  });
});

const storeMocks = vi.hoisted(() => ({
  latest: vi.fn(),
  getOverview: vi.fn(),
  getIndicators: vi.fn(),
  subscribeLive: vi.fn(async () => async () => undefined),
  createSql: vi.fn(() => ({})),
}));

vi.mock("server-only", () => ({}));
vi.mock("@app/store", () => ({
  createSql: storeMocks.createSql,
  createCandleRepo: () => ({ latest: storeMocks.latest }),
  createMarketCache: () => ({ getOverview: storeMocks.getOverview, getIndicators: storeMocks.getIndicators, subscribeLive: storeMocks.subscribeLive }),
}));

describe("createStoreBackend", async () => {
  const { createStoreBackend } = await import("@/lib/market/storeBackend");
  const { EMPTY_OVERVIEW } = await import("@/lib/market/backend");

  test("lazy connections; reads overview/candles/indicators from the store", async () => {
    const backend = createStoreBackend({ databaseUrl: "postgres://x", redisUrl: "redis://x" });
    expect(backend.kind).toBe("store");
    expect(storeMocks.createSql).not.toHaveBeenCalled();

    storeMocks.getOverview.mockResolvedValueOnce(null);
    expect(await backend.overview()).toBe(EMPTY_OVERVIEW);

    storeMocks.latest.mockResolvedValueOnce({ source: "Coinbase", bars });
    expect(await backend.candles("BTC", "1h")).toEqual({ source: "Coinbase", bars });
    expect(storeMocks.createSql).toHaveBeenCalledTimes(1);

    storeMocks.latest.mockResolvedValueOnce({ source: null, bars: [] });
    await expect(backend.candles("BTC", "1m")).rejects.toThrow("No stored candles");

    storeMocks.getIndicators.mockResolvedValueOnce(null);
    expect(await backend.indicators("BTC", "1h")).toBeNull();

    const off = await backend.subscribeLive(() => undefined);
    expect(storeMocks.subscribeLive).toHaveBeenCalledTimes(1);
    await off();
  });
});
