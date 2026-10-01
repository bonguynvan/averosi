import { describe, expect, test } from "vitest";
import { type Listing, MARKET_ASSETS, buildUniverse, findAsset, isExcludedAsset, normalizeSymbol, parseSymbol } from "../src/domain/assets";

const listing = (source: string, symbol: string, name?: string): Listing => ({ source, symbol, venueId: `${source}:${symbol}`, ...(name ? { name } : {}) });

describe("seed assets", () => {
  test("symbols are unique upper-case tickers", () => {
    const symbols = MARKET_ASSETS.map((a) => a.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols.every((s) => /^[A-Z]{2,6}$/.test(s))).toBe(true);
  });

  test("findAsset is case-insensitive and returns undefined for unknown", () => {
    expect(findAsset("btc")?.name).toBe("Bitcoin");
    expect(findAsset("XYZ")).toBeUndefined();
  });
});

describe("symbols", () => {
  test("parseSymbol accepts tickers with digits and rejects anything else", () => {
    expect(parseSymbol(" 1inch ")).toBe("1INCH");
    expect(parseSymbol("0G")).toBe("0G");
    for (const bad of ["", "BTC-USD", "../etc", "A".repeat(13), "bt c"]) expect(parseSymbol(bad)).toBeNull();
  });

  test("normalizes exchange-legacy tickers", () => {
    expect(normalizeSymbol("xbt")).toBe("BTC");
    expect(normalizeSymbol("XDG")).toBe("DOGE");
    expect(normalizeSymbol("eth")).toBe("ETH");
  });

  test("excludes stablecoins, fiat currencies and gold tokens (R2, R11)", () => {
    for (const s of ["USDT", "USDC", "PYUSD", "RLUSD", "USD1", "FDUSD", "EURC", "EURQ", "EUR", "GBP", "DAI", "PAXG", "XAUT"]) {
      expect(isExcludedAsset(s), s).toBe(true);
    }
    for (const s of ["BTC", "ETH", "AUDIO", "SUSHI", "EUL"]) expect(isExcludedAsset(s), s).toBe(false);
  });
});

describe("buildUniverse", () => {
  test("keeps assets listed on enough distinct exchanges, with venues per source", () => {
    const universe = buildUniverse(
      [
        listing("Coinbase", "BTC", "Bitcoin"),
        listing("Kraken", "XBT"),
        listing("Bitstamp", "BTC"),
        listing("Coinbase", "ZORA", "Zora"),
        listing("Kraken", "ZORA"),
        listing("Kraken", "ONLYHERE"),
        listing("Coinbase", "USDT", "Tether"),
        listing("Kraken", "USDT"),
      ],
      { minSources: 2 },
    );
    expect(universe.map((a) => a.symbol)).toEqual(["BTC", "ZORA"]);
    expect(universe[0]).toEqual({
      symbol: "BTC",
      name: "Bitcoin",
      sources: ["Bitstamp", "Coinbase", "Kraken"],
      venues: { Coinbase: "Coinbase:BTC", Kraken: "Kraken:XBT", Bitstamp: "Bitstamp:BTC" },
    });
  });

  test("counts an exchange once even if it lists a ticker twice, and falls back to the ticker as name", () => {
    const universe = buildUniverse([listing("Kraken", "ABC"), listing("Kraken", "ABC"), listing("Gemini", "ABC")], { minSources: 2 });
    expect(universe).toEqual([{ symbol: "ABC", name: "ABC", sources: ["Gemini", "Kraken"], venues: { Kraken: "Kraken:ABC", Gemini: "Gemini:ABC" } }]);
    expect(buildUniverse([listing("Kraken", "ABC"), listing("Kraken", "ABC")], { minSources: 2 })).toEqual([]);
  });

  test("seed names win over exchange names; invalid tickers are dropped", () => {
    const universe = buildUniverse([listing("Coinbase", "TRX", "Tron Network"), listing("Kraken", "TRX"), listing("Coinbase", "BAD-1"), listing("Kraken", "BAD-1")], { minSources: 2 });
    expect(universe).toHaveLength(1);
    expect(universe[0]?.name).toBe("TRON");
  });
});
