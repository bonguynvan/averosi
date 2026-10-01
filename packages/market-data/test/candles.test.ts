import { describe, expect, test, vi } from "vitest";
import { CANDLE_TIMEFRAMES, parseTimeframe } from "@app/core";
import { candleTtlMs, createCandleSource } from "../src/candles";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("parseTimeframe", () => {
  test("accepts timeframes both Coinbase and Kraken can serve", () => {
    for (const tf of ["1m", "5m", "15m", "1h", "1d"]) expect(parseTimeframe(tf)).toBe(tf);
    expect(parseTimeframe("4h")).toBeNull(); // Coinbase has no 4h
    expect(parseTimeframe("6h")).toBeNull(); // Kraken has no 6h
    expect(parseTimeframe("1w")).toBeNull();
  });

  test("cache TTL shrinks with the timeframe so polling stays fresh", () => {
    expect(candleTtlMs("1m")).toBeLessThan(candleTtlMs("1h"));
    expect(candleTtlMs("1h")).toBeLessThan(candleTtlMs("1d"));
  });
});

describe("createCandleSource", () => {
  test("Coinbase candles are returned oldest-first in chart format", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) =>
      json([
        [7200, 1, 4, 2, 3, 10],
        [3600, 0.5, 2, 1, 1.5, 5],
      ]),
    );
    const result = await createCandleSource({ fetchFn }).candles("BTC", "1h");
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600");
    expect(result).toEqual({
      source: "Coinbase",
      bars: [
        { time: 3600, open: 1, high: 2, low: 0.5, close: 1.5, volume: 5 },
        { time: 7200, open: 2, high: 4, low: 1, close: 3, volume: 10 },
      ],
    });
  });

  test("falls back to Kraken OHLC when Coinbase has no product", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("coinbase")
        ? json({ message: "NotFound" }, 404)
        : json({ error: [], result: { TRXUSD: [[86400, "0.33", "0.34", "0.32", "0.335", "0.333", "1000", 5]], last: 86400 } }),
    );
    const result = await createCandleSource({ fetchFn }).candles("TRX", "1d");
    expect(String(fetchFn.mock.calls[1]?.[0])).toBe("https://api.kraken.com/0/public/OHLC?pair=TRXUSD&interval=1440");
    expect(result).toEqual({ source: "Kraken", bars: [{ time: 86400, open: 0.33, high: 0.34, low: 0.32, close: 0.335, volume: 1000 }] });
  });

  test("throws when both sources fail", async () => {
    await expect(createCandleSource({ fetchFn: async () => json({}, 500) }).candles("BTC", "1h")).rejects.toThrow();
  });
});

describe("timeframe mapping", () => {
  test("maps to Coinbase granularity and Kraken interval", async () => {
    const urls: string[] = [];
    const fetchFn = async (url: string | URL | Request) => {
      urls.push(String(url));
      return json({}, 500);
    };
    await createCandleSource({ fetchFn }).candles("ETH", "15m").catch(() => undefined);
    expect(urls).toEqual([
      "https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=900",
      "https://api.kraken.com/0/public/OHLC?pair=ETHUSD&interval=15",
    ]);
    expect(CANDLE_TIMEFRAMES).toEqual(["1m", "5m", "15m", "1h", "1d"]);
  });
});
