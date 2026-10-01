import type { MarketOverview } from "@app/core";
import type { Sql } from "./db";

export interface QuoteRepo {
  /** Persists one overview snapshot (all assets + FX) for history and analytics. */
  record(overview: MarketOverview, takenAt: Date): Promise<void>;
  /** Price history of one asset (USD nano-units), ascending, since `since`. */
  history(symbol: string, since: Date): Promise<{ takenAt: Date; priceUsdNanos: bigint }[]>;
  prune(before: Date): Promise<number>;
}

export function createQuoteRepo(sql: Sql): QuoteRepo {
  return {
    async record(overview, takenAt) {
      await sql.begin(async (tx) => {
        if (overview.assets.length > 0) {
          const rows = overview.assets.map((a) => ({
            symbol: a.symbol,
            taken_at: takenAt,
            price_usd_nanos: a.priceUsdNanos.toString(),
            change_24h_bps: a.change24hBps,
            volume_usd_nanos: a.volume24hUsdNanos.toString(),
            sources: [...a.sources],
            max_deviation_bps: a.maxDeviationBps,
          }));
          await tx`INSERT INTO asset_quotes ${tx(rows)} ON CONFLICT DO NOTHING`;
        }
        if (overview.fx.status === "ok") {
          await tx`
            INSERT INTO fx_rates (taken_at, source, vnd_per_usd)
            VALUES (${overview.fx.fetchedAt}, ${overview.fx.source}, ${overview.fx.rateVnd.toString()})
            ON CONFLICT DO NOTHING`;
        }
      });
    },

    async history(symbol, since) {
      const rows = await sql<{ taken_at: Date; price_usd_nanos: string }[]>`
        SELECT taken_at, price_usd_nanos FROM asset_quotes
        WHERE symbol = ${symbol} AND taken_at >= ${since} ORDER BY taken_at ASC`;
      return rows.map((r) => ({ takenAt: r.taken_at, priceUsdNanos: BigInt(r.price_usd_nanos) }));
    },

    async prune(before) {
      return (await sql`DELETE FROM asset_quotes WHERE taken_at < ${before}`).count;
    },
  };
}
