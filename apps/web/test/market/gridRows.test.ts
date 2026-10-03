import type { MarketOverview } from "@app/core";
import { describe, expect, test } from "vitest";
import { changeTone, filterGridRows, formatCell, isLowConfidence, livePatch, toGridRows } from "@/lib/market/gridRows";
import { type QuoteDto, toQuotesDto } from "@/lib/market/quotesDto";

const quote = (symbol: string, priceUsd: number, volumeUsd: number, extra: Partial<QuoteDto> = {}): QuoteDto => ({
  symbol,
  name: `${symbol} name`,
  priceUsd,
  change24hBps: 120,
  volumeUsd,
  sources: ["Coinbase", "Kraken"],
  maxDeviationBps: 5,
  ...extra,
});

describe("toQuotesDto", () => {
  test("USD numbers from nano-units, names from the universe, null rate without FX", () => {
    const overview: MarketOverview = {
      assets: [
        {
          symbol: "PEPE",
          priceUsdNanos: 4_343n,
          change24hBps: -50,
          volume24hUsdNanos: 2_000_000_000_000n,
          sources: ["Coinbase", "Kraken"],
          maxDeviationBps: 16,
          priceVnd: 0n,
          volume24hVnd: 0n,
        },
      ],
      fx: { status: "failed" },
      sources: [],
    };
    expect(toQuotesDto(overview, new Map([["PEPE", "Pepe"]]))).toEqual({
      quotes: [{ symbol: "PEPE", name: "Pepe", priceUsd: 0.000004343, change24hBps: -50, volumeUsd: 2_000, sources: ["Coinbase", "Kraken"], maxDeviationBps: 16 }],
      vndPerUsd: null,
    });
    expect(toQuotesDto(overview, new Map()).quotes[0]?.name).toBe("PEPE");
  });
});

describe("toGridRows", () => {
  test("ranks by volume, converts to VND with the bank rate, keeps numbers for sorting", () => {
    const rows = toGridRows([quote("ETH", 2_700, 50), quote("BTC", 83_500, 90), quote("ADA", 0.7, 50)], 25_000);
    expect(rows.map((r) => [r.rank, r.symbol])).toEqual([
      [1, "BTC"],
      [2, "ADA"],
      [3, "ETH"],
    ]);
    expect(rows[0]).toMatchObject({ id: 1, symbol: "BTC", priceVnd: 2_087_500_000, volumeVnd: 2_250_000, sourceCount: 2, sources: "Coinbase, Kraken" });
    expect(toGridRows([quote("BTC", 1, 1)], null)[0]).toMatchObject({ priceVnd: null, volumeVnd: null });
  });

  test("filter: ticker prefix or name, accent-insensitive; empty query keeps all", () => {
    const rows = toGridRows([quote("BTC", 1, 3, { name: "Bitcoin" }), quote("BCH", 1, 2, { name: "Bitcoin Cash" }), quote("DONG", 1, 1, { name: "Đồng" })], 1);
    expect(filterGridRows(rows, "bitcoin").map((r) => r.symbol)).toEqual(["BTC", "BCH"]);
    expect(filterGridRows(rows, "ch").map((r) => r.symbol)).toEqual([]); // ticker match is prefix-only
    expect(filterGridRows(rows, "dong").map((r) => r.symbol)).toEqual(["DONG"]);
    expect(filterGridRows(rows, "  ")).toBe(rows);
  });

  test("live patch recomputes VND", () => {
    expect(livePatch(2, 25_000)).toEqual({ priceUsd: 2, priceVnd: 50_000 });
    expect(livePatch(2, null)).toEqual({ priceUsd: 2, priceVnd: null });
  });
});

describe("formatCell", () => {
  test("prices keep sub-dong precision; change always has a direction symbol", () => {
    expect(formatCell.vnd(2_152_630_000)).toBe("2.152.630.000 ₫");
    expect(formatCell.vnd(0.1122)).toBe("0,1122 ₫");
    expect(formatCell.vnd(null)).toBe("—");
    expect(formatCell.usd(83_500.5)).toBe("$83.500,50");
    expect(formatCell.usd(0.000004343)).toBe("$0,000004343");
    expect(formatCell.usd(undefined)).toBe("—");
    expect(formatCell.change(125)).toBe("▲ +1,25%");
    expect(formatCell.change(-80)).toBe("▼ -0,80%");
    expect(formatCell.change(0)).toBe("0,00%");
    expect(formatCell.change(null)).toBe("—");
    expect(formatCell.volume(2_100_000_000)).toBe("2,1 tỷ ₫");
    expect(formatCell.volume(Number.NaN)).toBe("—");
  });

  test("source column marks low confidence", () => {
    expect(formatCell.sources({ sourceCount: 4, maxDeviationBps: 5 })).toBe("4/4");
    expect(formatCell.sources({ sourceCount: 3, maxDeviationBps: 450 })).toBe("≠ 3/4");
    expect(isLowConfidence({ sourceCount: 1, maxDeviationBps: 0 })).toBe(true);
    expect(isLowConfidence({ sourceCount: 3, maxDeviationBps: 450 })).toBe(true);
    expect(isLowConfidence({ sourceCount: 3, maxDeviationBps: 10 })).toBe(false);
    expect([changeTone(5), changeTone(-5), changeTone(0), changeTone(null)]).toEqual(["up", "down", undefined, undefined]);
  });
});
