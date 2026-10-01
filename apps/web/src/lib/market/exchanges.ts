import { type MarketSource, type SourceQuote, parseDecimalToMicros, sourced } from "@app/core";
import { z } from "zod";
import { HttpStatusError, changeBps, fetchJson } from "./http";

/**
 * Public market-data adapters for exchanges with USD **fiat** pairs (no stablecoin quotes).
 * Exchange names are shown as data sources only — never linked, never promoted (LEGAL_REGISTER R3).
 */
export interface ExchangeOptions {
  readonly fetchFn?: typeof fetch;
  readonly now?: () => Date;
}

const COINBASE_CONCURRENCY = 5;
/** Kraken legacy pair names: query altname → response key. */
const KRAKEN_PAIRS: Record<string, { readonly query: string; readonly keys: readonly string[] }> = {
  BTC: { query: "XBTUSD", keys: ["XXBTZUSD", "XBTUSD"] },
  ETH: { query: "ETHUSD", keys: ["XETHZUSD", "ETHUSD"] },
  XRP: { query: "XRPUSD", keys: ["XXRPZUSD", "XRPUSD"] },
  LTC: { query: "LTCUSD", keys: ["XLTCZUSD", "LTCUSD"] },
  DOGE: { query: "XDGUSD", keys: ["XDGUSD", "XXDGZUSD"] },
};
const krakenPair = (symbol: string) => KRAKEN_PAIRS[symbol] ?? { query: `${symbol}USD`, keys: [`${symbol}USD`] };

function quote(source: string, symbol: string, last: string, extra: { change?: number | undefined; volume?: string | undefined }): SourceQuote[] {
  const lastUsdMicros = parseDecimalToMicros(last);
  if (lastUsdMicros === null || lastUsdMicros === 0n) return [];
  const volume = extra.volume === undefined ? null : parseDecimalToMicros(extra.volume);
  return [
    {
      source,
      symbol,
      lastUsdMicros,
      ...(extra.change === undefined ? {} : { change24hBps: extra.change }),
      ...(volume === null ? {} : { volume24hBaseMicros: volume }),
    },
  ];
}

const CoinbaseStats = z.object({ open: z.string(), last: z.string(), volume: z.string() });

export function createCoinbaseSource({ fetchFn = fetch, now = () => new Date() }: ExchangeOptions = {}): MarketSource {
  const name = "Coinbase";
  const one = async (symbol: string): Promise<SourceQuote[]> => {
    try {
      const s = CoinbaseStats.parse(await fetchJson(fetchFn, name, `https://api.exchange.coinbase.com/products/${symbol}-USD/stats`));
      return quote(name, symbol, s.last, { change: changeBps(Number(s.last), Number(s.open)), volume: s.volume });
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) return []; // product not listed
      throw error;
    }
  };

  return {
    name,
    async quotes(symbols) {
      const results: PromiseSettledResult<SourceQuote[]>[] = [];
      for (let i = 0; i < symbols.length; i += COINBASE_CONCURRENCY) {
        results.push(...(await Promise.allSettled(symbols.slice(i, i + COINBASE_CONCURRENCY).map(one))));
      }
      if (results.length > 0 && results.every((r) => r.status === "rejected")) throw new Error(`${name}: all requests failed`);
      return sourced(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])), name, now());
    },
  };
}

const KrakenTicker = z.object({
  error: z.array(z.string()),
  result: z.record(z.string(), z.object({ c: z.array(z.string()).min(1), v: z.array(z.string()).min(2) })).optional(),
});

export function createKrakenSource({ fetchFn = fetch, now = () => new Date() }: ExchangeOptions = {}): MarketSource {
  const name = "Kraken";
  return {
    name,
    async quotes(symbols) {
      const url = `https://api.kraken.com/0/public/Ticker?pair=${symbols.map((s) => krakenPair(s).query).join(",")}`;
      const body = KrakenTicker.parse(await fetchJson(fetchFn, name, url));
      if (body.error.length > 0) throw new Error(`${name}: ${body.error.join("; ")}`);
      const result = body.result ?? {};
      // Kraken's "o" is today's UTC open, not a rolling 24h open, so no change is reported.
      const data = symbols.flatMap((symbol) => {
        const key = krakenPair(symbol).keys.find((k) => result[k]);
        const t = key ? result[key] : undefined;
        return t ? quote(name, symbol, t.c[0] as string, { volume: t.v[1] }) : [];
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
