import { describe, expect, test, vi } from "vitest";
import { createBitstampSource, createCoinbaseSource, createGeminiSource, createKrakenSource } from "@/lib/market/exchanges";

const AT = new Date(0);
const now = () => AT;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Coinbase", () => {
  test("maps /stats to quotes with rolling 24h change and volume; skips unsupported products", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("TRX-USD")) return json({ message: "NotFound" }, 404);
      return json({ open: "100", last: "102", volume: "3.5" });
    });
    const src = createCoinbaseSource({ fetchFn, now });
    const result = await src.quotes(["BTC", "TRX"]);
    expect(src.name).toBe("Coinbase");
    expect(result.data).toEqual([
      { source: "Coinbase", symbol: "BTC", lastUsdMicros: 102_000_000n, change24hBps: 200, volume24hBaseMicros: 3_500_000n },
    ]);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe("https://api.exchange.coinbase.com/products/BTC-USD/stats");
  });

  test("throws when every product fails", async () => {
    const src = createCoinbaseSource({ fetchFn: async () => json({}, 503), now });
    await expect(src.quotes(["BTC"])).rejects.toThrow("Coinbase");
  });
});

describe("Kraken", () => {
  test("maps legacy pair keys (XXBTZUSD, XDGUSD) back to symbols; no rolling 24h change", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) =>
      json({
        error: [],
        result: {
          XXBTZUSD: { c: ["83519.1", "0.1"], v: ["1", "2.5"] },
          XDGUSD: { c: ["0.0944247", "1"], v: ["1", "10"] },
        },
      }),
    );
    const result = await createKrakenSource({ fetchFn, now }).quotes(["BTC", "DOGE"]);
    expect(result.data).toEqual([
      { source: "Kraken", symbol: "BTC", lastUsdMicros: 83_519_100_000n, volume24hBaseMicros: 2_500_000n },
      { source: "Kraken", symbol: "DOGE", lastUsdMicros: 94_424n, volume24hBaseMicros: 10_000_000n },
    ]);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,XDGUSD");
  });

  test("API-level errors throw", async () => {
    const src = createKrakenSource({ fetchFn: async () => json({ error: ["EGeneral:Too many requests"], result: {} }), now });
    await expect(src.quotes(["BTC"])).rejects.toThrow("Too many requests");
  });
});

describe("Bitstamp", () => {
  test("uses the all-tickers endpoint and open_24 for change", async () => {
    const fetchFn = async () =>
      json([
        { pair: "BTC/USD", last: "101", open_24: "100", volume: "2" },
        { pair: "BTC/EUR", last: "90", open_24: "90", volume: "1" },
        { pair: "ETH/USD", last: "bad", open_24: "1", volume: "1" },
      ]);
    const result = await createBitstampSource({ fetchFn, now }).quotes(["BTC", "ETH"]);
    expect(result.data).toEqual([{ source: "Bitstamp", symbol: "BTC", lastUsdMicros: 101_000_000n, change24hBps: 100, volume24hBaseMicros: 2_000_000n }]);
  });
});

describe("Gemini", () => {
  test("uses the price feed; percentChange24h is a fraction", async () => {
    const fetchFn = async () =>
      json([
        { pair: "BTCUSD", price: "83522.73", percentChange24h: "0.0061" },
        { pair: "TRXUSD", price: "0.337866", percentChange24h: "-0.0014" },
        { pair: "BTCEUR", price: "1", percentChange24h: "0" },
      ]);
    const result = await createGeminiSource({ fetchFn, now }).quotes(["BTC", "TRX", "ADA"]);
    expect(result.data).toEqual([
      { source: "Gemini", symbol: "BTC", lastUsdMicros: 83_522_730_000n, change24hBps: 61 },
      { source: "Gemini", symbol: "TRX", lastUsdMicros: 337_866n, change24hBps: -14 },
    ]);
  });

  test("HTTP errors throw with the source name", async () => {
    await expect(createGeminiSource({ fetchFn: async () => json({}, 500), now }).quotes(["BTC"])).rejects.toThrow("Gemini: HTTP 500");
  });
});
