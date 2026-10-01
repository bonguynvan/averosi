/** Timeframes served end-to-end (exchange proxy, worker, chart terminal). Both Coinbase and Kraken support them natively. */
export const CANDLE_TIMEFRAMES = ["1m", "5m", "15m", "1h", "1d"] as const;
export type Timeframe = (typeof CANDLE_TIMEFRAMES)[number];

export const TIMEFRAME_SECONDS: Readonly<Record<Timeframe, number>> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3_600, "1d": 86_400 };

/** OHLCV bar; `time` is the bucket start in unix seconds. Display-grade numbers (aggregates use bigint elsewhere). */
export interface Bar {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export function parseTimeframe(input: string): Timeframe | null {
  return (CANDLE_TIMEFRAMES as readonly string[]).includes(input) ? (input as Timeframe) : null;
}

/** Start of the bucket containing `unixSeconds` for the timeframe (UTC-aligned, like exchange candles). */
export function bucketStart(unixSeconds: number, timeframe: Timeframe): number {
  const size = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(unixSeconds / size) * size;
}
