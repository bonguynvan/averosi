export interface QuoteDto {
  readonly symbol: string;
  readonly priceUsd: number;
  readonly change24hBps: number | null;
}

export interface WatchlistUpdate {
  readonly symbol: string;
  readonly lastPrice: number;
  /** 24h-ago reference so the widget's % matches our rolling-24h median change. */
  readonly refPrice?: number;
}

/** Map our reference quotes to tradecanvas watchlist entries. Unknown change → no refPrice (widget shows no %). */
export function toWatchlistUpdates(quotes: readonly QuoteDto[]): WatchlistUpdate[] {
  return quotes
    .filter((q) => Number.isFinite(q.priceUsd) && q.priceUsd > 0)
    .map((q) =>
      q.change24hBps === null
        ? { symbol: q.symbol, lastPrice: q.priceUsd }
        : { symbol: q.symbol, lastPrice: q.priceUsd, refPrice: q.priceUsd / (1 + q.change24hBps / 10_000) },
    );
}
