import { describe, expect, test, vi } from "vitest";
import { createVietcombankFx, parseVietcombankUsdTransfer } from "../src/fx";

const XML = `<!--For reference only. Only one request every 5 minutes!-->
<ExrateList>
  <DateTime>10/1/2026 3:44:22 PM</DateTime>
  <Exrate CurrencyCode="AUD" CurrencyName="AUSTRALIAN DOLLAR" Buy="17,569.36" Transfer="17,746.83" Sell="18,315.53" />
  <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR           " Buy="25,750.00" Transfer="25,780.00" Sell="26,160.00" />
  <Source>Joint Stock Commercial Bank for Foreign Trade of Vietnam - Vietcombank</Source>
</ExrateList>`;

describe("parseVietcombankUsdTransfer", () => {
  test("extracts the USD transfer rate as whole dong", () => {
    expect(parseVietcombankUsdTransfer(XML)).toBe(25_780n);
  });

  test("rejects missing USD or implausible values", () => {
    expect(() => parseVietcombankUsdTransfer("<ExrateList/>")).toThrow("USD rate not found");
    expect(() => parseVietcombankUsdTransfer(XML.replace("25,780.00", "257.80"))).toThrow("implausible");
  });
});

describe("createVietcombankFx", () => {
  test("caches for the TTL to respect the 1-request-per-5-minutes note", async () => {
    let t = 0;
    const fetchFn = vi.fn(async () => new Response(XML));
    const fx = createVietcombankFx({ fetchFn, now: () => new Date(t), ttlMs: 30 * 60_000 });
    expect(await fx.usdVndRate()).toEqual({ data: 25_780n, source: "Vietcombank (USD chuyển khoản)", fetchedAt: new Date(0) });
    t = 10 * 60_000;
    await fx.usdVndRate();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
