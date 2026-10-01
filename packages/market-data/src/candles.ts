import type { Bar, Timeframe } from "@app/core";
import { z } from "zod";
import { fetchJson } from "./http";

export interface CandleResult {
  readonly source: string;
  readonly bars: readonly Bar[];
}

export interface CandleSource {
  candles(symbol: string, timeframe: Timeframe): Promise<CandleResult>;
}

const TIMEFRAMES: Record<Timeframe, { readonly coinbaseGranularity: number; readonly krakenInterval: number; readonly ttlMs: number }> = {
  "1m": { coinbaseGranularity: 60, krakenInterval: 1, ttlMs: 10_000 },
  "5m": { coinbaseGranularity: 300, krakenInterval: 5, ttlMs: 20_000 },
  "15m": { coinbaseGranularity: 900, krakenInterval: 15, ttlMs: 30_000 },
  "1h": { coinbaseGranularity: 3_600, krakenInterval: 60, ttlMs: 60_000 },
  "1d": { coinbaseGranularity: 86_400, krakenInterval: 1_440, ttlMs: 300_000 },
};

/** Server cache lifetime per timeframe: short for intraday so chart polling stays near real time. */
export function candleTtlMs(timeframe: Timeframe): number {
  return TIMEFRAMES[timeframe].ttlMs;
}


// Coinbase: [time, low, high, open, close, volume], newest first.
const CoinbaseCandles = z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]));
// Kraken: [time, open, high, low, close, vwap, volume, count]
const KrakenOhlc = z.object({
  error: z.array(z.string()),
  result: z.record(z.string(), z.unknown()).optional(),
});
const KrakenRow = z.tuple([z.number(), z.string(), z.string(), z.string(), z.string(), z.string(), z.string(), z.number()]);

async function coinbase(fetchFn: typeof fetch, symbol: string, tf: Timeframe): Promise<CandleResult> {
  const url = `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=${TIMEFRAMES[tf].coinbaseGranularity}`;
  const rows = CoinbaseCandles.parse(await fetchJson(fetchFn, "Coinbase", url));
  const bars = rows.map(([time, low, high, open, close, volume]) => ({ time, open, high, low, close, volume })).sort((a, b) => a.time - b.time);
  return { source: "Coinbase", bars };
}

async function kraken(fetchFn: typeof fetch, symbol: string, tf: Timeframe): Promise<CandleResult> {
  const pair = symbol === "BTC" ? "XBTUSD" : symbol === "DOGE" ? "XDGUSD" : `${symbol}USD`;
  const body = KrakenOhlc.parse(await fetchJson(fetchFn, "Kraken", `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${TIMEFRAMES[tf].krakenInterval}`));
  if (body.error.length > 0) throw new Error(`Kraken: ${body.error.join("; ")}`);
  const series = Object.entries(body.result ?? {}).find(([key]) => key !== "last")?.[1];
  const rows = z.array(KrakenRow).parse(series);
  const bars = rows.map(([time, open, high, low, close, , volume]) => ({
    time,
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume),
  }));
  return { source: "Kraken", bars };
}

/** Coinbase first, Kraken as fallback (e.g. TRX is not listed on Coinbase). */
export function createCandleSource({ fetchFn = fetch }: { fetchFn?: typeof fetch } = {}): CandleSource {
  return {
    async candles(symbol, timeframe) {
      try {
        return await coinbase(fetchFn, symbol, timeframe);
      } catch {
        return kraken(fetchFn, symbol, timeframe);
      }
    },
  };
}
