import type { MarketAsset } from "@app/core";

/**
 * Search, sort and pagination for the market table, driven by URL params (shareable state).
 * No sort by 24h change: ranking by gains reads as promotion (LEGAL_REGISTER R4).
 */
export const MARKET_SORTS = [
  { id: "khoi-luong", label: "Khối lượng 24h" },
  { id: "ma", label: "Mã A→Z" },
  { id: "gia", label: "Giá (cao → thấp)" },
] as const;
export type MarketSort = (typeof MARKET_SORTS)[number]["id"];

export const MARKET_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 40;

export interface MarketQuery {
  readonly q: string;
  readonly sort: MarketSort;
  readonly page: number;
}

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseMarketQuery(params: { q?: Param; "sap-xep"?: Param; trang?: Param }): MarketQuery {
  const q = first(params.q).trim().slice(0, MAX_QUERY_LENGTH);
  const rawSort = first(params["sap-xep"]);
  const sort = MARKET_SORTS.find((s) => s.id === rawSort)?.id ?? "khoi-luong";
  const page = Number.parseInt(first(params.trang), 10);
  return { q, sort, page: Number.isInteger(page) && page > 0 ? page : 1 };
}

/** Lower-case, accents removed: "Đồng" and "dong" match each other. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

const compareBigintDesc = (a: bigint, b: bigint) => (a > b ? -1 : a < b ? 1 : 0);

const SORTERS: Record<MarketSort, (a: MarketAsset, b: MarketAsset) => number> = {
  "khoi-luong": (a, b) => compareBigintDesc(a.volume24hUsdMicros, b.volume24hUsdMicros) || a.symbol.localeCompare(b.symbol),
  ma: (a, b) => a.symbol.localeCompare(b.symbol),
  gia: (a, b) => compareBigintDesc(a.priceUsdMicros, b.priceUsdMicros) || a.symbol.localeCompare(b.symbol),
};

export interface MarketPage {
  readonly rows: readonly MarketAsset[];
  readonly total: number;
  readonly page: number;
  readonly pages: number;
  /** 1-based rank of the first row within the filtered, sorted list. */
  readonly offset: number;
}

/** Filters by ticker (prefix) or name (substring, accent-insensitive), sorts, and slices one page. */
export function selectMarketPage(assets: readonly MarketAsset[], names: ReadonlyMap<string, string>, query: MarketQuery, pageSize = MARKET_PAGE_SIZE): MarketPage {
  const needle = fold(query.q);
  const matches = needle
    ? assets.filter((a) => fold(a.symbol).startsWith(needle) || fold(names.get(a.symbol) ?? "").includes(needle))
    : assets;
  const sorted = [...matches].sort(SORTERS[query.sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(query.page, pages);
  const start = (page - 1) * pageSize;
  return { rows: sorted.slice(start, start + pageSize), total: sorted.length, page, pages, offset: start + 1 };
}

/** URL for a page/sort/search combination; default values are omitted to keep links short. */
export function marketHref(query: MarketQuery, change: Partial<MarketQuery> = {}): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.sort !== "khoi-luong") params.set("sap-xep", next.sort);
  if (next.page > 1) params.set("trang", String(next.page));
  const qs = params.toString();
  return qs ? `/thi-truong?${qs}` : "/thi-truong";
}
