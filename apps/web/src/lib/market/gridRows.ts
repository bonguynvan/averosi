import { formatBps, formatUsdNanos, formatVndCompact, formatVndPrice } from "@app/core";
import type { QuoteDto } from "./quotesDto";
import { fold } from "./table";

/**
 * Rows and cell formatting for the live market grid (bo-grid). Pure: unit-tested here, the grid
 * component only wires them up. Values stay numeric so the grid sorts them correctly.
 */
export interface MarketGridRow {
  /** bo-grid's numeric row id (= rank); rows are keyed by `symbol` via getRowId. */
  readonly id: number;
  /** 1-based rank by 24h aggregated volume. */
  readonly rank: number;
  readonly symbol: string;
  readonly name: string;
  readonly priceUsd: number;
  readonly priceVnd: number | null;
  readonly change24hBps: number | null;
  readonly volumeVnd: number | null;
  readonly sourceCount: number;
  readonly sources: string;
  readonly maxDeviationBps: number;
  [key: string]: unknown;
}

export const TOTAL_SOURCES = 4;
/** Sources disagreeing by more than this (3%) get the ≠ data-quality mark. */
export const DEVIATION_WARN_BPS = 300;

export function toGridRows(quotes: readonly QuoteDto[], vndPerUsd: number | null): MarketGridRow[] {
  return [...quotes]
    .sort((a, b) => b.volumeUsd - a.volumeUsd || a.symbol.localeCompare(b.symbol))
    .map((q, i) => ({
      id: i + 1,
      rank: i + 1,
      symbol: q.symbol,
      name: q.name,
      priceUsd: q.priceUsd,
      priceVnd: vndPerUsd === null ? null : q.priceUsd * vndPerUsd,
      change24hBps: q.change24hBps,
      volumeVnd: vndPerUsd === null ? null : q.volumeUsd * vndPerUsd,
      sourceCount: q.sources.length,
      sources: q.sources.join(", "),
      maxDeviationBps: q.maxDeviationBps,
    }));
}

/** Same matching as the server table: ticker prefix or name substring, accent-insensitive. */
export function filterGridRows(rows: readonly MarketGridRow[], query: string): readonly MarketGridRow[] {
  const needle = fold(query.trim());
  if (!needle) return rows;
  return rows.filter((r) => fold(r.symbol).startsWith(needle) || fold(r.name).includes(needle));
}

/** Live price → patch for one row (VND recomputed from the page's bank rate). */
export function livePatch(priceUsd: number, vndPerUsd: number | null): Pick<MarketGridRow, "priceUsd" | "priceVnd"> {
  return { priceUsd, priceVnd: vndPerUsd === null ? null : priceUsd * vndPerUsd };
}

const NANO = 1e9;
const toNanos = (value: number) => BigInt(Math.round(value * NANO));
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const formatCell = {
  vnd: (v: unknown) => (isNumber(v) ? formatVndPrice(toNanos(v)) : "—"),
  usd: (v: unknown) => (isNumber(v) ? formatUsdNanos(toNanos(v)) : "—"),
  /** Direction is always paired with a symbol, never colour alone. */
  change: (v: unknown) => (!isNumber(v) ? "—" : v > 0 ? `▲ ${formatBps(v)}` : v < 0 ? `▼ ${formatBps(v)}` : formatBps(v)),
  volume: (v: unknown) => (isNumber(v) ? formatVndCompact(BigInt(Math.round(v))) : "—"),
  sources: (row: Pick<MarketGridRow, "sourceCount" | "maxDeviationBps">) =>
    `${row.maxDeviationBps > DEVIATION_WARN_BPS ? "≠ " : ""}${row.sourceCount}/${TOTAL_SOURCES}`,
};

export const changeTone = (v: unknown): "up" | "down" | undefined => (isNumber(v) ? (v > 0 ? "up" : v < 0 ? "down" : undefined) : undefined);

export const isLowConfidence = (row: Pick<MarketGridRow, "sourceCount" | "maxDeviationBps">): boolean =>
  row.sourceCount < 2 || row.maxDeviationBps > DEVIATION_WARN_BPS;
