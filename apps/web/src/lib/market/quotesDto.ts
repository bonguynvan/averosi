import type { MarketOverview } from "@app/core";

/**
 * JSON shape of /api/thi-truong: compact reference quotes (USD, display-grade numbers) for client
 * widgets — the chart watchlist and the live market grid. Same data as the server-rendered table.
 */
export interface QuoteDto {
  readonly symbol: string;
  readonly name: string;
  readonly priceUsd: number;
  readonly change24hBps: number | null;
  /** Sum over the aggregated sources only, USD. */
  readonly volumeUsd: number;
  readonly sources: readonly string[];
  readonly maxDeviationBps: number;
}

export interface QuotesDto {
  readonly quotes: readonly QuoteDto[];
  readonly vndPerUsd: number | null;
}

const NANOS = 1_000_000_000;

export function toQuotesDto(overview: MarketOverview, names: ReadonlyMap<string, string>): QuotesDto {
  return {
    quotes: overview.assets.map((a) => ({
      symbol: a.symbol,
      name: names.get(a.symbol) ?? a.symbol,
      priceUsd: Number(a.priceUsdNanos) / NANOS,
      change24hBps: a.change24hBps,
      volumeUsd: Number(a.volume24hUsdNanos) / NANOS,
      sources: a.sources,
      maxDeviationBps: a.maxDeviationBps,
    })),
    vndPerUsd: overview.fx.status === "ok" ? Number(overview.fx.rateVnd) : null,
  };
}
