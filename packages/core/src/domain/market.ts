import type { Vnd } from "./money";

/**
 * Market reference prices aggregated from several exchanges' public USD (fiat) pairs.
 * Amounts are micro-units (1e-6) held as bigint — never floats.
 */
export const MICROS = 1_000_000n;
const BPS = 10_000n;

export interface SourceQuote {
  readonly source: string;
  readonly symbol: string;
  readonly lastUsdMicros: bigint;
  /** 24h change in basis points, when the exchange provides a true rolling-24h open. */
  readonly change24hBps?: number;
  /** Rolling 24h traded volume in base-asset micro-units. */
  readonly volume24hBaseMicros?: bigint;
}

export interface AssetSnapshot {
  readonly symbol: string;
  readonly priceUsdMicros: bigint;
  readonly change24hBps: number | null;
  /** Sum over the aggregated sources only — not global market volume. */
  readonly volume24hUsdMicros: bigint;
  readonly sources: readonly string[];
  /** Largest deviation of a single source from the median, in bps (data-quality signal). */
  readonly maxDeviationBps: number;
}

const DECIMAL = /^\d+(\.\d+)?$/;

export function parseDecimalToMicros(input: string): bigint | null {
  if (!DECIMAL.test(input)) return null;
  const [whole = "0", fraction = ""] = input.split(".");
  return BigInt(whole) * MICROS + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

export function medianBigint(values: readonly bigint[]): bigint {
  if (values.length === 0) throw new Error("median of empty list");
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] as bigint;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] as bigint) + upper) / 2n;
}

function medianNumber(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] as number;
  return sorted.length % 2 === 1 ? upper : Math.round(((sorted[mid - 1] as number) + upper) / 2);
}

/** USD micro-units × VND-per-USD → whole dong, rounded half up. */
export function usdMicrosToVnd(usdMicros: bigint, vndPerUsd: Vnd): Vnd {
  return (usdMicros * vndPerUsd + MICROS / 2n) / MICROS;
}

function aggregateSymbol(symbol: string, quotes: readonly SourceQuote[]): AssetSnapshot {
  const price = medianBigint(quotes.map((q) => q.lastUsdMicros));
  const changes = quotes.flatMap((q) => (q.change24hBps === undefined ? [] : [q.change24hBps]));
  const volume = quotes.reduce((sum, q) => sum + ((q.volume24hBaseMicros ?? 0n) * q.lastUsdMicros) / MICROS, 0n);
  const deviation = quotes.reduce((max, q) => {
    const diff = q.lastUsdMicros > price ? q.lastUsdMicros - price : price - q.lastUsdMicros;
    const bps = Number((diff * BPS) / price);
    return bps > max ? bps : max;
  }, 0);

  return {
    symbol,
    priceUsdMicros: price,
    change24hBps: medianNumber(changes),
    volume24hUsdMicros: volume,
    sources: quotes.map((q) => q.source).sort(),
    maxDeviationBps: deviation,
  };
}

export function aggregateQuotes(symbols: readonly string[], quotes: readonly SourceQuote[]): AssetSnapshot[] {
  return symbols.flatMap((symbol) => {
    const forSymbol = quotes.filter((q) => q.symbol === symbol && q.lastUsdMicros > 0n);
    return forSymbol.length === 0 ? [] : [aggregateSymbol(symbol, forSymbol)];
  });
}
