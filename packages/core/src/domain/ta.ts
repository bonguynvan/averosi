import type { Bar } from "./candles";

/**
 * Technical-analysis primitives. Pure, deterministic, server-side friendly.
 * Every series is aligned with its input; warm-up positions are null.
 * Values are descriptive statistics — never turned into buy/sell verdicts (LEGAL_REGISTER R4).
 */
export type Series = (number | null)[];

function assertPeriod(period: number): void {
  if (!Number.isInteger(period) || period <= 0) throw new Error(`Invalid period: ${period}`);
}

export function sma(values: readonly number[], period: number): Series {
  assertPeriod(period);
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= period) sum -= values[i - period] as number;
    return i >= period - 1 ? sum / period : null;
  });
}

export function ema(values: readonly number[], period: number): Series {
  assertPeriod(period);
  const k = 2 / (period + 1);
  const out: Series = values.map(() => null);
  if (values.length < period) return out;
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (values[i] as number) * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

const rsiFrom = (gain: number, loss: number) => (loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss));

/** Wilder's RSI. */
export function rsi(values: readonly number[], period = 14): Series {
  assertPeriod(period);
  const out: Series = values.map(() => null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = (values[i] as number) - (values[i - 1] as number);
    gain += Math.max(d, 0);
    loss += Math.max(-d, 0);
  }
  gain /= period;
  loss /= period;
  out[period] = rsiFrom(gain, loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = (values[i] as number) - (values[i - 1] as number);
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = rsiFrom(gain, loss);
  }
  return out;
}

export function macd(values: readonly number[], fast = 12, slow = 26, signalPeriod = 9): { line: Series; signal: Series; histogram: Series } {
  if (fast >= slow) throw new Error("macd: fast period must be shorter than slow period");
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line: Series = values.map((_, i) => (f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null));
  const start = line.findIndex((v) => v !== null);
  const signal: Series = values.map(() => null);
  if (start >= 0) {
    const tail = ema(line.slice(start) as number[], signalPeriod);
    tail.forEach((v, j) => (signal[start + j] = v));
  }
  const histogram: Series = line.map((v, i) => (v !== null && signal[i] != null ? v - (signal[i] as number) : null));
  return { line, signal, histogram };
}

export function bollinger(values: readonly number[], period = 20, k = 2): { middle: Series; upper: Series; lower: Series } {
  const middle = sma(values, period);
  const sd: Series = middle.map((m, i) => {
    if (m === null) return null;
    const window = values.slice(i - period + 1, i + 1);
    return Math.sqrt(window.reduce((acc, v) => acc + (v - m) ** 2, 0) / period);
  });
  return {
    middle,
    upper: middle.map((m, i) => (m === null ? null : m + k * (sd[i] as number))),
    lower: middle.map((m, i) => (m === null ? null : m - k * (sd[i] as number))),
  };
}

/** Wilder's Average True Range. */
export function atr(bars: readonly Bar[], period = 14): Series {
  assertPeriod(period);
  const tr = bars.map((b, i) => {
    const prevClose = i > 0 ? (bars[i - 1] as Bar).close : b.close;
    return Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose));
  });
  const out: Series = bars.map(() => null);
  if (bars.length <= period) return out;
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < bars.length; i++) {
    prev = (prev * (period - 1) + (tr[i] as number)) / period;
    out[i] = prev;
  }
  return out;
}

const last = (s: Series): number | null => (s.length > 0 ? (s[s.length - 1] ?? null) : null);

export interface IndicatorSnapshot {
  readonly close: number | null;
  readonly sma20: number | null;
  readonly sma50: number | null;
  readonly sma200: number | null;
  readonly ema20: number | null;
  readonly rsi14: number | null;
  readonly macd: { readonly line: number; readonly signal: number | null; readonly histogram: number | null } | null;
  readonly bollinger20: { readonly middle: number; readonly upper: number; readonly lower: number } | null;
  readonly atr14: number | null;
}

/** Latest values of the standard indicator set for one series of bars. */
export function indicatorSnapshot(bars: readonly Bar[]): IndicatorSnapshot {
  const closes = bars.map((b) => b.close);
  const m = macd(closes);
  const bb = bollinger(closes);
  const macdLine = last(m.line);
  const bbMiddle = last(bb.middle);
  return {
    close: closes.length > 0 ? (closes[closes.length - 1] as number) : null,
    sma20: last(sma(closes, 20)),
    sma50: last(sma(closes, 50)),
    sma200: last(sma(closes, 200)),
    ema20: last(ema(closes, 20)),
    rsi14: last(rsi(closes, 14)),
    macd: macdLine === null ? null : { line: macdLine, signal: last(m.signal), histogram: last(m.histogram) },
    bollinger20: bbMiddle === null ? null : { middle: bbMiddle, upper: last(bb.upper) as number, lower: last(bb.lower) as number },
    atr14: last(atr(bars, 14)),
  };
}
