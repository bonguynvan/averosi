import { describe, expect, test } from "vitest";
import { MARKET_ASSETS, findAsset } from "../src/domain/assets";

describe("assets", () => {
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
