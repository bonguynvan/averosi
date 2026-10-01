import { describe, expect, test } from "vitest";
import type { FxSource, MarketSource } from "../src/application/ports";
import { getMarketOverview } from "../src/application/usecases/getMarketOverview";
import { sourced } from "../src/domain/sourced";

const AT = new Date("2026-10-01T08:00:00Z");

const source = (name: string, prices: Record<string, string>): MarketSource => ({
  name,
  quotes: async (symbols) =>
    sourced(
      symbols.filter((s) => prices[s]).map((s) => ({ source: name, symbol: s, lastUsdNanos: BigInt(prices[s] ?? "0") * 1_000_000_000n })),
      name,
      AT,
    ),
});
const broken = (name: string): MarketSource => ({
  name,
  quotes: async () => {
    throw new Error("down");
  },
});
const fx: FxSource = { usdVndRate: async () => sourced(25_000n, "Vietcombank", AT) };

describe("getMarketOverview", () => {
  test("aggregates sources and converts to VND", async () => {
    const overview = await getMarketOverview(
      { sources: [source("A", { BTC: "100" }), source("B", { BTC: "102" })], fx },
      { symbols: ["BTC"] },
    );
    expect(overview.fx).toEqual({ status: "ok", rateVnd: 25_000n, source: "Vietcombank", fetchedAt: AT });
    expect(overview.assets).toEqual([
      expect.objectContaining({ symbol: "BTC", priceUsdNanos: 101_000_000_000n, priceVnd: 2_525_000n, sources: ["A", "B"] }),
    ]);
    expect(overview.sources).toEqual([
      { name: "A", status: "ok", fetchedAt: AT },
      { name: "B", status: "ok", fetchedAt: AT },
    ]);
  });

  test("a failing exchange is reported but does not break the overview", async () => {
    const overview = await getMarketOverview({ sources: [source("A", { BTC: "100" }), broken("B")], fx }, { symbols: ["BTC"] });
    expect(overview.assets[0]?.sources).toEqual(["A"]);
    expect(overview.sources[1]).toEqual({ name: "B", status: "failed" });
  });

  test("without an FX rate, VND prices are null rather than guessed", async () => {
    const noFx: FxSource = {
      usdVndRate: async () => {
        throw new Error("down");
      },
    };
    const overview = await getMarketOverview({ sources: [source("A", { BTC: "100" })], fx: noFx }, { symbols: ["BTC"] });
    expect(overview.fx).toEqual({ status: "failed" });
    expect(overview.assets[0]?.priceVnd).toBeNull();
    expect(overview.assets[0]?.volume24hVnd).toBeNull();
  });
});
