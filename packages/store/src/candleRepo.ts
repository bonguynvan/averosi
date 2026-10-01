import type { Bar, Timeframe } from "@app/core";
import type { Sql } from "./db";

export interface CandleRepo {
  /** Idempotent: re-fetched buckets overwrite the stored ones (the forming candle keeps updating). */
  upsert(symbol: string, timeframe: Timeframe, source: string, bars: readonly Bar[]): Promise<number>;
  /** Most recent `limit` bars, ascending by time. */
  latest(symbol: string, timeframe: Timeframe, limit: number): Promise<{ source: string | null; bars: Bar[] }>;
  /** Deletes bars older than `before` for a timeframe (retention). Returns deleted count. */
  prune(timeframe: Timeframe, before: Date): Promise<number>;
}

export function createCandleRepo(sql: Sql): CandleRepo {
  return {
    async upsert(symbol, timeframe, source, bars) {
      if (bars.length === 0) return 0;
      const rows = bars.map((b) => ({
        symbol,
        timeframe,
        bucket_start: new Date(b.time * 1000),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        source,
      }));
      const result = await sql`
        INSERT INTO candles ${sql(rows)}
        ON CONFLICT (symbol, timeframe, bucket_start) DO UPDATE SET
          open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close,
          volume = EXCLUDED.volume, source = EXCLUDED.source, updated_at = now()`;
      return result.count;
    },

    async latest(symbol, timeframe, limit) {
      const rows = await sql<{ t: string; open: number; high: number; low: number; close: number; volume: number; source: string }[]>`
        SELECT extract(epoch FROM bucket_start)::bigint AS t, open, high, low, close, volume, source
        FROM candles WHERE symbol = ${symbol} AND timeframe = ${timeframe}
        ORDER BY bucket_start DESC LIMIT ${limit}`;
      const bars = rows.reverse().map((r) => ({ time: Number(r.t), open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
      return { source: rows.at(-1)?.source ?? null, bars };
    },

    async prune(timeframe, before) {
      const result = await sql`DELETE FROM candles WHERE timeframe = ${timeframe} AND bucket_start < ${before}`;
      return result.count;
    },
  };
}
