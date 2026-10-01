import type { MarketAsset } from "@app/core";
import { describe, expect, test } from "vitest";
import { MARKET_SORTS, fold, marketHref, parseMarketQuery, selectMarketPage } from "@/lib/market/table";

const asset = (symbol: string, price: bigint, volume: bigint): MarketAsset => ({
  symbol,
  priceUsdNanos: price,
  change24hBps: 0,
  volume24hUsdNanos: volume,
  sources: ["A", "B"],
  maxDeviationBps: 0,
  priceVnd: null,
  volume24hVnd: null,
});

const ASSETS = [asset("ETH", 3_000n, 50n), asset("BTC", 80_000n, 90n), asset("DOGE", 1n, 50n), asset("BCH", 400n, 10n)];
const NAMES = new Map([
  ["ETH", "Ethereum"],
  ["BTC", "Bitcoin"],
  ["DOGE", "Dogecoin"],
  ["BCH", "Bitcoin Cash"],
]);
const query = (q = "", sort: (typeof MARKET_SORTS)[number]["id"] = "khoi-luong", page = 1) => ({ q, sort, page });

describe("parseMarketQuery", () => {
  test("defaults, valid values, and garbage", () => {
    expect(parseMarketQuery({})).toEqual({ q: "", sort: "khoi-luong", page: 1 });
    expect(parseMarketQuery({ q: "  btc ", "sap-xep": "gia", trang: "3" })).toEqual({ q: "btc", sort: "gia", page: 3 });
    expect(parseMarketQuery({ q: ["a", "b"], "sap-xep": "bien-dong", trang: "-2" })).toEqual({ q: "a", sort: "khoi-luong", page: 1 });
    expect(parseMarketQuery({ q: "x".repeat(100), trang: "abc" }).q).toHaveLength(40);
  });

  test("never offers sorting by 24h change (R4)", () => {
    expect(MARKET_SORTS.map((s) => s.id)).not.toContain("bien-dong");
    expect(MARKET_SORTS.map((s) => s.label).join(" ")).not.toMatch(/tăng|giảm|biến động/i);
  });
});

describe("selectMarketPage", () => {
  test("sorts by volume (ties by ticker), by ticker, or by price", () => {
    expect(selectMarketPage(ASSETS, NAMES, query()).rows.map((a) => a.symbol)).toEqual(["BTC", "DOGE", "ETH", "BCH"]);
    expect(selectMarketPage(ASSETS, NAMES, query("", "ma")).rows.map((a) => a.symbol)).toEqual(["BCH", "BTC", "DOGE", "ETH"]);
    expect(selectMarketPage(ASSETS, NAMES, query("", "gia")).rows.map((a) => a.symbol)).toEqual(["BTC", "ETH", "BCH", "DOGE"]);
  });

  test("search matches ticker prefix or name, case- and accent-insensitive", () => {
    expect(selectMarketPage(ASSETS, NAMES, query("b")).rows.map((a) => a.symbol)).toEqual(["BTC", "BCH"]);
    expect(selectMarketPage(ASSETS, NAMES, query("BITCOIN")).rows.map((a) => a.symbol)).toEqual(["BTC", "BCH"]);
    expect(selectMarketPage(ASSETS, NAMES, query("coin")).total).toBe(3);
    expect(selectMarketPage(ASSETS, NAMES, query("CH")).total).toBe(0); // ticker match is prefix-only (BCH)
    expect(selectMarketPage(ASSETS, new Map([["ETH", "Đồng Ê"]]), query("dong e")).rows.map((a) => a.symbol)).toEqual(["ETH"]);
  });

  test("paginates and clamps out-of-range pages", () => {
    const page2 = selectMarketPage(ASSETS, NAMES, query("", "ma", 2), 3);
    expect(page2).toMatchObject({ total: 4, page: 2, pages: 2, offset: 4 });
    expect(page2.rows.map((a) => a.symbol)).toEqual(["ETH"]);
    expect(selectMarketPage(ASSETS, NAMES, query("", "ma", 99), 3).page).toBe(2);
    expect(selectMarketPage([], NAMES, query("", "ma", 5))).toMatchObject({ total: 0, page: 1, pages: 1, rows: [] });
  });
});

describe("marketHref", () => {
  test("omits defaults; changing search resets nothing implicitly", () => {
    expect(marketHref(query())).toBe("/thi-truong");
    expect(marketHref(query("sol", "gia", 2))).toBe("/thi-truong?q=sol&sap-xep=gia&trang=2");
    expect(marketHref(query("sol", "gia", 2), { page: 1 })).toBe("/thi-truong?q=sol&sap-xep=gia");
  });

  test("fold", () => {
    expect(fold("Đồng Việt")).toBe("dong viet");
  });
});
