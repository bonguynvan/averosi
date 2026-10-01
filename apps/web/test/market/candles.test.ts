import { describe, expect, test, vi } from "vitest";
import { createCandleSource, parseTimeframe } from "@/lib/market/candles";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("parseTimeframe", () => {
  test("accepts 1h and 1d only", () => {
    expect(parseTimeframe("1h")).toBe("1h");
    expect(parseTimeframe("1d")).toBe("1d");
    expect(parseTimeframe("5m")).toBeNull();
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
