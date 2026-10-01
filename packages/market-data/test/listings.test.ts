import { describe, expect, test, vi } from "vitest";
import { collectListings, createListingSources } from "../src/listings";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const BODIES: Record<string, unknown> = {
  "api.coinbase.com": {
    products: [
      { product_id: "BTC-USD", base_currency_id: "BTC", quote_currency_id: "USD", base_name: "Bitcoin", status: "online" },
      { product_id: "OLD-USD", base_currency_id: "OLD", quote_currency_id: "USD", status: "delisted" },
      { product_id: "BTC-EUR", base_currency_id: "BTC", quote_currency_id: "EUR", status: "online" },
    ],
  },
  "api.kraken.com": { error: [], result: { XXBTZUSD: { altname: "XBTUSD", wsname: "XBT/USD", status: "online" }, ADAEUR: { altname: "ADAEUR", wsname: "ADA/EUR" } } },
  "www.bitstamp.net": [
    { name: "BTC/USD", url_symbol: "btcusd", trading: "Enabled", description: "Bitcoin / U.S. dollar" },
    { name: "XYZ/USD", url_symbol: "xyzusd", trading: "Disabled" },
  ],
  "api.gemini.com": [
    { pair: "BTCUSD", price: "1" },
    { pair: "BTCGUSD", price: "1" },
    { pair: "ETHBTC", price: "1" },
  ],
};

const fetchFn = vi.fn(async (url: string | URL | Request) => json(BODIES[new URL(String(url)).host]));

describe("listing sources", () => {
  test("each exchange yields only live USD (fiat) products with its own product id", async () => {
    const { listings, failed } = await collectListings(createListingSources({ fetchFn }));
    expect(failed).toEqual([]);
    expect(listings).toEqual([
      { source: "Coinbase", symbol: "BTC", venueId: "BTC-USD", name: "Bitcoin" },
      { source: "Kraken", symbol: "BTC", venueId: "XBTUSD" },
      { source: "Bitstamp", symbol: "BTC", venueId: "btcusd", name: "Bitcoin" },
      { source: "Gemini", symbol: "BTC", venueId: "BTCUSD" },
    ]);
  });

  test("a failing catalog is reported and does not hide the others", async () => {
    const flaky = vi.fn(async (url: string | URL | Request) => (String(url).includes("kraken") ? json({}, 500) : json(BODIES[new URL(String(url)).host])));
    const { listings, failed } = await collectListings(createListingSources({ fetchFn: flaky }));
    expect(failed).toEqual(["Kraken"]);
    expect(listings.map((l) => l.source)).toEqual(["Coinbase", "Bitstamp", "Gemini"]);
  });

  test("Kraken API-level errors fail that catalog", async () => {
    const bad = async (url: string | URL | Request) => (String(url).includes("kraken") ? json({ error: ["EService:Busy"] }) : json(BODIES[new URL(String(url)).host]));
    expect((await collectListings(createListingSources({ fetchFn: bad }))).failed).toEqual(["Kraken"]);
  });
});
