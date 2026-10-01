import { type Listing, normalizeSymbol } from "@app/core";
import { z } from "zod";
import { fetchJson } from "./http";

/**
 * Public product catalogs: which assets each exchange lists against USD (fiat). Used daily by the
 * worker to build the asset universe. Exclusions (stablecoins, fiat) happen in @app/core buildUniverse.
 */
export interface ListingSource {
  readonly name: string;
  listings(): Promise<Listing[]>;
}

const CATALOG_TIMEOUT_MS = 20_000;

export const COINBASE_PRODUCTS_URL = "https://api.coinbase.com/api/v3/brokerage/market/products?product_type=SPOT";
export const KRAKEN_ASSET_PAIRS_URL = "https://api.kraken.com/0/public/AssetPairs";

export const CoinbaseProducts = z.object({
  products: z.array(
    z
      .object({
        product_id: z.string(),
        base_currency_id: z.string(),
        quote_currency_id: z.string(),
        base_name: z.string().optional(),
        status: z.string().optional(),
        is_disabled: z.boolean().optional(),
        trading_disabled: z.boolean().optional(),
        price: z.string().optional(),
        price_percentage_change_24h: z.string().optional(),
        volume_24h: z.string().optional(),
      })
      .passthrough(),
  ),
});
export type CoinbaseProduct = z.infer<typeof CoinbaseProducts>["products"][number];

export const isLiveCoinbaseUsd = (p: CoinbaseProduct) => p.quote_currency_id === "USD" && p.status === "online" && !p.is_disabled && !p.trading_disabled;

export const KrakenAssetPairs = z.object({
  error: z.array(z.string()),
  result: z.record(z.string(), z.object({ altname: z.string(), wsname: z.string().optional(), status: z.string().optional() }).passthrough()).optional(),
});

/** Kraken pair key → our symbol, for online USD pairs ("XXBTZUSD" → "BTC"), plus its altname for queries. */
export function krakenUsdPairs(body: z.infer<typeof KrakenAssetPairs>): { key: string; altname: string; symbol: string }[] {
  if (body.error.length > 0) throw new Error(`Kraken: ${body.error.join("; ")}`);
  return Object.entries(body.result ?? {}).flatMap(([key, p]) => {
    const [base, quote] = (p.wsname ?? "").split("/");
    if (!base || quote !== "USD" || (p.status !== undefined && p.status !== "online")) return [];
    return [{ key, altname: p.altname, symbol: normalizeSymbol(base) }];
  });
}

const BitstampPairs = z.array(z.object({ name: z.string(), url_symbol: z.string(), trading: z.string(), description: z.string().optional() }));
const GeminiFeed = z.array(z.object({ pair: z.string(), price: z.string() }));

export function createListingSources({ fetchFn = fetch }: { fetchFn?: typeof fetch } = {}): ListingSource[] {
  const get = (source: string, url: string) => fetchJson(fetchFn, source, url, CATALOG_TIMEOUT_MS);
  return [
    {
      name: "Coinbase",
      async listings() {
        const { products } = CoinbaseProducts.parse(await get("Coinbase", COINBASE_PRODUCTS_URL));
        return products
          .filter(isLiveCoinbaseUsd)
          .map((p) => ({ source: "Coinbase", symbol: p.base_currency_id, venueId: p.product_id, ...(p.base_name ? { name: p.base_name } : {}) }));
      },
    },
    {
      name: "Kraken",
      async listings() {
        const pairs = krakenUsdPairs(KrakenAssetPairs.parse(await get("Kraken", KRAKEN_ASSET_PAIRS_URL)));
        return pairs.map((p) => ({ source: "Kraken", symbol: p.symbol, venueId: p.altname }));
      },
    },
    {
      name: "Bitstamp",
      async listings() {
        const pairs = BitstampPairs.parse(await get("Bitstamp", "https://www.bitstamp.net/api/v2/trading-pairs-info/"));
        return pairs.flatMap((p) => {
          const [base, quote] = p.name.split("/");
          if (!base || quote !== "USD" || p.trading !== "Enabled") return [];
          const name = p.description?.split(" / ")[0];
          return [{ source: "Bitstamp", symbol: base, venueId: p.url_symbol, ...(name ? { name } : {}) }];
        });
      },
    },
    {
      name: "Gemini",
      async listings() {
        const feed = GeminiFeed.parse(await get("Gemini", "https://api.gemini.com/v1/pricefeed"));
        return feed.flatMap((p) =>
          p.pair.endsWith("USD") && !p.pair.endsWith("GUSD") && p.pair.length > 3 ? [{ source: "Gemini", symbol: p.pair.slice(0, -3), venueId: p.pair }] : [],
        );
      },
    },
  ];
}

/** Collects listings from every source; a failing catalog is reported, not fatal (the others still count). */
export async function collectListings(sources: readonly ListingSource[]): Promise<{ listings: Listing[]; failed: string[] }> {
  const results = await Promise.allSettled(sources.map((s) => s.listings()));
  return {
    listings: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    failed: sources.flatMap((s, i) => (results[i]?.status === "rejected" ? [s.name] : [])),
  };
}
