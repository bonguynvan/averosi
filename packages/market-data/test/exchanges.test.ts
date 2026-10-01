import { describe, expect, test, vi } from "vitest";
import { createBitstampSource, createCoinbaseSource, createGeminiSource, createKrakenSource } from "../src/exchanges";

const AT = new Date(0);
const now = () => AT;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const cbProduct = (base: string, price: string, extra: Record<string, unknown> = {}) => ({
  product_id: `${base}-USD`,
  base_currency_id: base,
  quote_currency_id: "USD",
  status: "online",
  is_disabled: false,
  trading_disabled: false,
  price,
  price_percentage_change_24h: "2",
  volume_24h: "3.5",
  ...extra,
});

describe("Coinbase", () => {
  test("one bulk products call → quotes with rolling 24h change (percent → bps) and volume", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) =>
      json({
        products: [
          cbProduct("BTC", "102"),
          cbProduct("ETH", "3000", { status: "delisted" }),
          cbProduct("SOL", "150", { trading_disabled: true }),
          { ...cbProduct("BTC", "99"), product_id: "BTC-EUR", quote_currency_id: "EUR" },
          cbProduct("ADA", "0.7", { price_percentage_change_24h: "" }),
        ],
      }),
    );
    const src = createCoinbaseSource({ fetchFn, now });
    const result = await src.quotes(["BTC", "ETH", "SOL", "ADA", "TRX"]);
    expect(src.name).toBe("Coinbase");
    expect(result.data).toEqual([
      { source: "Coinbase", symbol: "BTC", lastUsdMicros: 102_000_000n, change24hBps: 200, volume24hBaseMicros: 3_500_000n },
      { source: "Coinbase", symbol: "ADA", lastUsdMicros: 700_000n, volume24hBaseMicros: 3_500_000n },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("HTTP failure throws with the source name", async () => {
    const src = createCoinbaseSource({ fetchFn: async () => json({}, 503), now });
    await expect(src.quotes(["BTC"])).rejects.toThrow("Coinbase");
  });
});

const KRAKEN_PAIRS = {
  error: [],
  result: {
    XXBTZUSD: { altname: "XBTUSD", wsname: "XBT/USD", status: "online" },
    XDGUSD: { altname: "XDGUSD", wsname: "XDG/USD", status: "online" },
    XXBTZEUR: { altname: "XBTEUR", wsname: "XBT/EUR", status: "online" },
    OLDUSD: { altname: "OLDUSD", wsname: "OLD/USD", status: "delisted" },
  },
};

describe("Kraken", () => {
  test("maps symbols through the cached pair catalog and queries only the wanted pairs", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("AssetPairs")
        ? json(KRAKEN_PAIRS)
        : json({ error: [], result: { XXBTZUSD: { c: ["83519.1", "0.1"], v: ["1", "2.5"] }, XDGUSD: { c: ["0.0944247", "1"], v: ["1", "10"] } } }),
    );
    const src = createKrakenSource({ fetchFn, now });
    const result = await src.quotes(["BTC", "DOGE", "OLD"]);
    expect(result.data).toEqual([
      { source: "Kraken", symbol: "BTC", lastUsdMicros: 83_519_100_000n, volume24hBaseMicros: 2_500_000n },
      { source: "Kraken", symbol: "DOGE", lastUsdMicros: 94_424n, volume24hBaseMicros: 10_000_000n },
    ]);
    expect(String(fetchFn.mock.calls[1]?.[0])).toBe("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,XDGUSD");
    await src.quotes(["BTC"]);
    expect(fetchFn.mock.calls.filter(([u]) => String(u).includes("AssetPairs"))).toHaveLength(1);
  });

  test("no listed symbols → empty result without a ticker call", async () => {
    const fetchFn = vi.fn(async () => json(KRAKEN_PAIRS));
    expect((await createKrakenSource({ fetchFn, now }).quotes(["NOPE"])).data).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("API-level errors throw", async () => {
    const fetchFn = async (url: string | URL | Request) => (String(url).includes("AssetPairs") ? json(KRAKEN_PAIRS) : json({ error: ["EGeneral:Too many requests"], result: {} }));
    await expect(createKrakenSource({ fetchFn, now }).quotes(["BTC"])).rejects.toThrow("Too many requests");
    await expect(createKrakenSource({ fetchFn: async () => json({ error: ["EService:Unavailable"] }), now }).quotes(["BTC"])).rejects.toThrow("Unavailable");
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
