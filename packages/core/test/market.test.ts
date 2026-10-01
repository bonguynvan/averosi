import { describe, expect, test } from "vitest";
import { MIN_PRICE_USD_NANOS, OUTLIER_BPS, aggregateQuotes, medianBigint, parseDecimalToNanos, usdNanosToVnd, type SourceQuote } from "../src/domain/market";

const q = (source: string, symbol: string, last: string, extra: Partial<SourceQuote> = {}): SourceQuote => {
  const lastUsdNanos = parseDecimalToNanos(last);
  if (lastUsdNanos === null) throw new Error("fixture");
  return { source, symbol, lastUsdNanos, ...extra };
};

describe("parseDecimalToNanos", () => {
  test("parses integers and decimals into nano-units (9 decimals, truncated)", () => {
    expect(parseDecimalToNanos("83497.89")).toBe(83_497_890_000_000n);
    expect(parseDecimalToNanos("0.1234567891")).toBe(123_456_789n);
    expect(parseDecimalToNanos("0.00000919")).toBe(9_190n);
    expect(parseDecimalToNanos("42")).toBe(42_000_000_000n);
  });

  test("returns null for anything that is not a plain non-negative decimal", () => {
    for (const bad of ["", "-1", "1e5", "abc", "1.2.3", " 1", "NaN"]) expect(parseDecimalToNanos(bad)).toBeNull();
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

describe("usdNanosToVnd", () => {
  test("converts and rounds half up to whole dong", () => {
    expect(usdNanosToVnd(83_497_890_000_000n, 25_780n)).toBe(2_152_575_604n);
    expect(usdNanosToVnd(500_000_000n, 1n)).toBe(1n);
    expect(usdNanosToVnd(0n, 25_780n)).toBe(0n);
  });
});

describe("aggregateQuotes", () => {
  test("median price, median 24h change, summed USD volume, sorted source names", () => {
    const quotes = [
      q("Kraken", "BTC", "100", { volume24hBaseNanos: 2_000_000_000n }),
      q("Coinbase", "BTC", "102", { change24hBps: 150, volume24hBaseNanos: 1_000_000_000n }),
      q("Bitstamp", "BTC", "101", { change24hBps: 100 }),
    ];
    expect(aggregateQuotes(["BTC"], quotes)).toEqual([
      {
        symbol: "BTC",
        priceUsdNanos: 101_000_000_000n,
        change24hBps: 125,
        volume24hUsdNanos: 302_000_000_000n,
        sources: ["Bitstamp", "Coinbase", "Kraken"],
        maxDeviationBps: 99,
      },
    ]);
  });

  test("symbols without quotes are omitted; missing change yields null", () => {
    const result = aggregateQuotes(["BTC", "ETH"], [q("Kraken", "ETH", "3000")]);
    expect(result).toEqual([
      { symbol: "ETH", priceUsdNanos: 3_000_000_000_000n, change24hBps: null, volume24hUsdNanos: 0n, sources: ["Kraken"], maxDeviationBps: 0 },
    ]);
  });

  test("keeps the requested symbol order", () => {
    const result = aggregateQuotes(["SOL", "BTC"], [q("A", "BTC", "1"), q("A", "SOL", "2")]);
    expect(result.map((r) => r.symbol)).toEqual(["SOL", "BTC"]);
  });

  test("ignores zero prices (bad source data)", () => {
    const result = aggregateQuotes(["BTC"], [q("A", "BTC", "0"), q("B", "BTC", "50")]);
    expect(result[0]?.priceUsdNanos).toBe(50_000_000_000n);
    expect(result[0]?.sources).toEqual(["B"]);
  });

  test("drops a source that disagrees with the median by more than OUTLIER_BPS (ticker collision)", () => {
    const result = aggregateQuotes(["ONE"], [q("A", "ONE", "1.00"), q("B", "ONE", "1.02"), q("C", "ONE", "0.99"), q("D", "ONE", "7.50")]);
    expect(result[0]?.sources).toEqual(["A", "B", "C"]);
    expect(result[0]?.maxDeviationBps).toBeLessThan(OUTLIER_BPS);
  });

  test("keeps sub-cent assets (PEPE) exactly; hides only those below MIN_PRICE_USD_NANOS", () => {
    expect(aggregateQuotes(["PEPE"], [q("A", "PEPE", "0.00000919"), q("B", "PEPE", "0.00000921")])[0]?.priceUsdNanos).toBe(9_200n);
    expect(aggregateQuotes(["X"], [q("A", "X", "0.000000999"), q("B", "X", "0.000000999")])).toEqual([]);
    expect(aggregateQuotes(["X"], [q("A", "X", "0.000001"), q("B", "X", "0.000001")])[0]?.priceUsdNanos).toBe(MIN_PRICE_USD_NANOS);
  });

  test("hides an asset whose only two sources disagree badly, rather than guessing", () => {
    expect(aggregateQuotes(["ONE"], [q("A", "ONE", "1"), q("B", "ONE", "3")])).toEqual([]);
    expect(aggregateQuotes(["ONE"], [q("A", "ONE", "1"), q("B", "ONE", "1.1")])).toHaveLength(1);
  });
});
