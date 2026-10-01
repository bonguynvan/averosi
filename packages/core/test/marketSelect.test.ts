import { describe, expect, test } from "vitest";
import { topByAbsChange, topByVolume, totalVolume } from "../src/domain/marketSelect";

const a = (symbol: string, vol: bigint, change: number | null) => ({ symbol, volume24hUsdMicros: vol, change24hBps: change });

describe("market selections (neutral: no 'top gainers')", () => {
  const assets = [a("BTC", 900n, 50), a("ETH", 500n, -300), a("SOL", 700n, 120), a("XRP", 100n, null)];

  test("topByVolume sorts by volume, does not mutate", () => {
    const copy = [...assets];
    expect(topByVolume(assets, 2).map((x) => x.symbol)).toEqual(["BTC", "SOL"]);
    expect(assets).toEqual(copy);
  });

  test("topByAbsChange ranks rises and falls together and skips unknown change", () => {
    expect(topByAbsChange(assets, 3).map((x) => x.symbol)).toEqual(["ETH", "SOL", "BTC"]);
  });

  test("ties keep input order", () => {
    const tie = [a("A", 5n, 10), a("B", 5n, -10), a("C", 9n, 0)];
    expect(topByVolume(tie, 3).map((x) => x.symbol)).toEqual(["C", "A", "B"]);
    expect(topByAbsChange(tie, 3).map((x) => x.symbol)).toEqual(["A", "B", "C"]);
  });

  test("totalVolume sums", () => {
    expect(totalVolume(assets)).toBe(2_200n);
  });
});
