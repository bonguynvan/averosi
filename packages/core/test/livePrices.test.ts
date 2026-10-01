import { describe, expect, test } from "vitest";
import { createLivePriceBook } from "../src/domain/livePrices";

describe("LivePriceBook", () => {
  test("median of the latest tick per source; only changed symbols are flushed", () => {
    const book = createLivePriceBook({ maxAgeMs: 60_000 });
    book.add({ symbol: "BTC", source: "Coinbase", price: 100, at: 1_000 });
    book.add({ symbol: "BTC", source: "Kraken", price: 102, at: 1_100 });
    book.add({ symbol: "ETH", source: "Kraken", price: 10, at: 1_100 });
    expect(book.flush(2_000)).toEqual([
      { symbol: "BTC", priceUsd: 101, sources: 2, at: 1_100 },
      { symbol: "ETH", priceUsd: 10, sources: 1, at: 1_100 },
    ]);
    expect(book.flush(2_100)).toEqual([]); // nothing changed

    book.add({ symbol: "BTC", source: "Coinbase", price: 104, at: 2_200 }); // replaces Coinbase's previous tick
    expect(book.flush(2_300)).toEqual([{ symbol: "BTC", priceUsd: 103, sources: 2, at: 2_200 }]);
  });

  test("stale ticks are excluded; a symbol with only stale ticks is not emitted", () => {
    const book = createLivePriceBook({ maxAgeMs: 1_000 });
    book.add({ symbol: "BTC", source: "Coinbase", price: 100, at: 0 });
    book.add({ symbol: "BTC", source: "Kraken", price: 110, at: 5_000 });
    expect(book.flush(5_500)).toEqual([{ symbol: "BTC", priceUsd: 110, sources: 1, at: 5_000 }]);
    book.add({ symbol: "SOL", source: "Kraken", price: 1, at: 0 });
    expect(book.flush(9_000)).toEqual([]);
  });

  test("ignores non-finite or non-positive prices", () => {
    const book = createLivePriceBook({ maxAgeMs: 1_000 });
    book.add({ symbol: "BTC", source: "A", price: Number.NaN, at: 0 });
    book.add({ symbol: "BTC", source: "B", price: 0, at: 0 });
    expect(book.flush(10)).toEqual([]);
  });

  test("odd number of sources uses the middle value", () => {
    const book = createLivePriceBook({ maxAgeMs: 1_000 });
    for (const [source, price] of [["A", 1], ["B", 50], ["C", 3]] as const) book.add({ symbol: "X", source, price, at: 0 });
    expect(book.flush(1)[0]?.priceUsd).toBe(3);
  });
});
