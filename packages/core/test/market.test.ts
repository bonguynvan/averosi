import { describe, expect, test } from "vitest";
import { aggregateQuotes, medianBigint, parseDecimalToMicros, usdMicrosToVnd, type SourceQuote } from "../src/domain/market";

const q = (source: string, symbol: string, last: string, extra: Partial<SourceQuote> = {}): SourceQuote => {
  const lastUsdMicros = parseDecimalToMicros(last);
  if (lastUsdMicros === null) throw new Error("fixture");
  return { source, symbol, lastUsdMicros, ...extra };
};

describe("parseDecimalToMicros", () => {
  test("parses integers and decimals into micro-units", () => {
    expect(parseDecimalToMicros("83497.89")).toBe(83_497_890_000n);
    expect(parseDecimalToMicros("0.123456789")).toBe(123_456n);
    expect(parseDecimalToMicros("42")).toBe(42_000_000n);
  });

  test("returns null for anything that is not a plain non-negative decimal", () => {
    for (const bad of ["", "-1", "1e5", "abc", "1.2.3", " 1", "NaN"]) expect(parseDecimalToMicros(bad)).toBeNull();
  });
});

describe("medianBigint", () => {
  test("odd and even lengths", () => {
    expect(medianBigint([3n, 1n, 2n])).toBe(2n);
    expect(medianBigint([4n, 1n, 2n, 3n])).toBe(2n); // (2+3)/2 truncated
    expect(medianBigint([10n, 20n])).toBe(15n);
  });

  test("handles duplicates", () => {
    expect(medianBigint([2n, 2n, 1n, 2n])).toBe(2n);
    const quotes = [q("A", "X", "1", { change24hBps: 5 }), q("B", "X", "1", { change24hBps: 5 }), q("C", "X", "1", { change24hBps: 1 })];
    expect(aggregateQuotes(["X"], quotes)[0]?.change24hBps).toBe(5);
  });

  test("throws on empty input", () => {
    expect(() => medianBigint([])).toThrow();
  });
});

describe("usdMicrosToVnd", () => {
  test("converts and rounds half up to whole dong", () => {
    expect(usdMicrosToVnd(83_497_890_000n, 25_780n)).toBe(2_152_575_604n);
    expect(usdMicrosToVnd(500_000n, 1n)).toBe(1n);
    expect(usdMicrosToVnd(0n, 25_780n)).toBe(0n);
  });
});

describe("aggregateQuotes", () => {
  test("median price, median 24h change, summed USD volume, sorted source names", () => {
    const quotes = [
      q("Kraken", "BTC", "100", { volume24hBaseMicros: 2_000_000n }),
      q("Coinbase", "BTC", "102", { change24hBps: 150, volume24hBaseMicros: 1_000_000n }),
      q("Bitstamp", "BTC", "101", { change24hBps: 100 }),
    ];
    expect(aggregateQuotes(["BTC"], quotes)).toEqual([
      {
        symbol: "BTC",
        priceUsdMicros: 101_000_000n,
        change24hBps: 125,
        volume24hUsdMicros: 302_000_000n,
        sources: ["Bitstamp", "Coinbase", "Kraken"],
        maxDeviationBps: 99,
      },
    ]);
  });

  test("symbols without quotes are omitted; missing change yields null", () => {
    const result = aggregateQuotes(["BTC", "ETH"], [q("Kraken", "ETH", "3000")]);
    expect(result).toEqual([
      { symbol: "ETH", priceUsdMicros: 3_000_000_000n, change24hBps: null, volume24hUsdMicros: 0n, sources: ["Kraken"], maxDeviationBps: 0 },
    ]);
  });

  test("keeps the requested symbol order", () => {
    const result = aggregateQuotes(["SOL", "BTC"], [q("A", "BTC", "1"), q("A", "SOL", "2")]);
    expect(result.map((r) => r.symbol)).toEqual(["SOL", "BTC"]);
  });

  test("ignores zero prices (bad source data)", () => {
    const result = aggregateQuotes(["BTC"], [q("A", "BTC", "0"), q("B", "BTC", "50")]);
    expect(result[0]?.priceUsdMicros).toBe(50_000_000n);
    expect(result[0]?.sources).toEqual(["B"]);
  });
});
