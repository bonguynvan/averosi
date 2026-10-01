import { describe, expect, test } from "vitest";
import { toWatchlistUpdates } from "@/lib/chart/watchlist";

describe("toWatchlistUpdates", () => {
  test("derives the 24h reference price from the change in bps", () => {
    const [u] = toWatchlistUpdates([{ symbol: "BTC", priceUsd: 101, change24hBps: 100 }]);
    expect(u?.symbol).toBe("BTC");
    expect(u?.lastPrice).toBe(101);
    expect(u?.refPrice).toBeCloseTo(100, 10);
  });

  test("omits refPrice when change is unknown and drops invalid prices", () => {
    expect(
      toWatchlistUpdates([
        { symbol: "ETH", priceUsd: 2700, change24hBps: null },
        { symbol: "BAD", priceUsd: 0, change24hBps: 5 },
        { symbol: "NAN", priceUsd: Number.NaN, change24hBps: 5 },
      ]),
    ).toEqual([{ symbol: "ETH", lastPrice: 2700 }]);
  });
});
