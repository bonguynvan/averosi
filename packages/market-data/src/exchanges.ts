import { type MarketSource, type SourceQuote, parseDecimalToNanos, sourced } from "@app/core";
import { z } from "zod";
import { changeBps, fetchJson } from "./http";
import { COINBASE_PRODUCTS_URL, CoinbaseProducts, KRAKEN_ASSET_PAIRS_URL, KrakenAssetPairs, isLiveCoinbaseUsd, krakenUsdPairs } from "./listings";

/**
 * Public market-data adapters for exchanges with USD **fiat** pairs (no stablecoin quotes).
 * Exchange names are shown as data sources only — never linked, never promoted (LEGAL_REGISTER R3).
 */
export interface ExchangeOptions {
  readonly fetchFn?: typeof fetch;
  readonly now?: () => Date;
}

/** Kraken's pair catalog changes rarely; refetch it at most this often. */
const KRAKEN_PAIRS_TTL_MS = 6 * 3_600_000;
/** Whole-market responses are larger than a single ticker. */
const BULK_TIMEOUT_MS = 15_000;

function quote(source: string, symbol: string, last: string, extra: { change?: number | undefined; volume?: string | undefined }): SourceQuote[] {
  const lastUsdNanos = parseDecimalToNanos(last);
  if (lastUsdNanos === null || lastUsdNanos === 0n) return [];
  const volume = extra.volume === undefined ? null : parseDecimalToNanos(extra.volume);
  return [
    {
      source,
      symbol,
      lastUsdNanos,
      ...(extra.change === undefined ? {} : { change24hBps: extra.change }),
      ...(volume === null ? {} : { volume24hBaseNanos: volume }),
    },
  ];
}

/** One request for every product: price, rolling-24h change (percent) and 24h base volume. */
export function createCoinbaseSource({ fetchFn = fetch, now = () => new Date() }: ExchangeOptions = {}): MarketSource {
  const name = "Coinbase";
  return {
    name,
    async quotes(symbols) {
      const { products } = CoinbaseProducts.parse(await fetchJson(fetchFn, name, COINBASE_PRODUCTS_URL, BULK_TIMEOUT_MS));
      const bySymbol = new Map(products.filter(isLiveCoinbaseUsd).map((p) => [p.base_currency_id, p]));
      const data = symbols.flatMap((symbol) => {
        const p = bySymbol.get(symbol);
        if (!p?.price) return [];
        const percent = Number(p.price_percentage_change_24h);
        return quote(name, symbol, p.price, { change: Number.isFinite(percent) && p.price_percentage_change_24h ? Math.round(percent * 100) : undefined, volume: p.volume_24h });
      });
      return sourced(data, name, now());
    },
  };
}

const KrakenTicker = z.object({
  error: z.array(z.string()),
  result: z.record(z.string(), z.object({ c: z.array(z.string()).min(1), v: z.array(z.string()).min(2) })).optional(),
});

/** Pair catalog (cached) maps our symbols to Kraken's pair keys; then one Ticker call for all of them. */
export function createKrakenSource({ fetchFn = fetch, now = () => new Date() }: ExchangeOptions = {}): MarketSource {
  const name = "Kraken";
  let catalog: { at: number; bySymbol: Map<string, { key: string; altname: string }> } | null = null;
  const pairs = async () => {
    if (catalog && now().getTime() - catalog.at < KRAKEN_PAIRS_TTL_MS) return catalog.bySymbol;
    const list = krakenUsdPairs(KrakenAssetPairs.parse(await fetchJson(fetchFn, name, KRAKEN_ASSET_PAIRS_URL, BULK_TIMEOUT_MS)));
    catalog = { at: now().getTime(), bySymbol: new Map(list.map((p) => [p.symbol, { key: p.key, altname: p.altname }])) };
    return catalog.bySymbol;
  };

  return {
    name,
    async quotes(symbols) {
      const bySymbol = await pairs();
      const wanted = symbols.flatMap((s) => {
        const p = bySymbol.get(s);
        return p ? [{ symbol: s, ...p }] : [];
      });
      if (wanted.length === 0) return sourced([], name, now());
      const url = `https://api.kraken.com/0/public/Ticker?pair=${wanted.map((w) => w.altname).join(",")}`;
      const body = KrakenTicker.parse(await fetchJson(fetchFn, name, url, BULK_TIMEOUT_MS));
      if (body.error.length > 0) throw new Error(`${name}: ${body.error.join("; ")}`);
      const result = body.result ?? {};
      // Kraken's "o" is today's UTC open, not a rolling 24h open, so no change is reported.
      const data = wanted.flatMap((w) => {
        const t = result[w.key] ?? result[w.altname];
        return t ? quote(name, w.symbol, t.c[0] as string, { volume: t.v[1] }) : [];
      });
      return sourced(data, name, now());
    },
  };
}

const BitstampTickers = z.array(z.object({ pair: z.string(), last: z.string(), open_24: z.string().optional(), volume: z.string().optional() }));

export function createBitstampSource({ fetchFn = fetch, now = () => new Date() }: ExchangeOptions = {}): MarketSource {
  const name = "Bitstamp";
  return {
    name,
    async quotes(symbols) {
      const tickers = BitstampTickers.parse(await fetchJson(fetchFn, name, "https://www.bitstamp.net/api/v2/ticker/"));
      const byPair = new Map(tickers.map((t) => [t.pair, t]));
      const data = symbols.flatMap((symbol) => {
        const t = byPair.get(`${symbol}/USD`);
        return t ? quote(name, symbol, t.last, { change: t.open_24 ? changeBps(Number(t.last), Number(t.open_24)) : undefined, volume: t.volume }) : [];
      });
      return sourced(data, name, now());
    },
  };
}

const GeminiFeed = z.array(z.object({ pair: z.string(), price: z.string(), percentChange24h: z.string() }));

export function createGeminiSource({ fetchFn = fetch, now = () => new Date() }: ExchangeOptions = {}): MarketSource {
  const name = "Gemini";
  return {
    name,
    async quotes(symbols) {
      const feed = GeminiFeed.parse(await fetchJson(fetchFn, name, "https://api.gemini.com/v1/pricefeed"));
      const byPair = new Map(feed.map((p) => [p.pair, p]));
      const data = symbols.flatMap((symbol) => {
        const p = byPair.get(`${symbol}USD`);
        const fraction = p ? Number(p.percentChange24h) : Number.NaN;
        return p ? quote(name, symbol, p.price, { change: Number.isFinite(fraction) ? Math.round(fraction * 10_000) : undefined }) : [];
      });
      return sourced(data, name, now());
    },
  };
}
