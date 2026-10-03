"use client";

import type { BoGridElement } from "bo-grid/element";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { GRID_LABELS, GRID_THEME, marketColumns } from "@/lib/market/gridConfig";
import { type MarketGridRow, filterGridRows, livePatch, toGridRows } from "@/lib/market/gridRows";
import type { QuotesDto } from "@/lib/market/quotesDto";
import { useLiveQuotes } from "./LivePrices";

/** Overview fields (24h change, volume, sources) refresh this often; prices stream live in between. */
const REFRESH_MS = 60_000;
const MIN_HEIGHT = 420;
const MAX_HEIGHT = 760;

type GridApi = { patchRows(patches: Iterable<readonly [string, Record<string, unknown>]>): number; exportCSV(filename?: string): Promise<void> };

async function loadQuotes(): Promise<QuotesDto | null> {
  const res = await fetch("/api/thi-truong", { headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const body = (await res.json()) as QuotesDto;
  return Array.isArray(body.quotes) && body.quotes.length > 0 ? body : null;
}

/**
 * Progressive enhancement for /thi-truong. The server-rendered table (children) works without
 * JavaScript and for crawlers. Once the page is idle, the bo-grid element (≈69 KB, lazy) and the full
 * quote list load, and the live grid replaces the table in place: all assets, instant search and sort,
 * price flashes from the same-origin stream. Any failure keeps the server table.
 */
export function MarketBoard({ children }: { children: ReactNode }) {
  const [data, setData] = useState<QuotesDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = () =>
      Promise.all([import("bo-grid/element"), loadQuotes()])
        .then(([, quotes]) => {
          if (!cancelled && quotes) setData(quotes);
        })
        .catch(() => undefined);
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(() => void start(), { timeout: 2_000 }) : window.setTimeout(() => void start(), 300);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  return data ? <LiveMarketGrid initial={data} /> : <>{children}</>;
}

function LiveMarketGrid({ initial }: { initial: QuotesDto }) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<BoGridElement | null>(null);
  const api = useRef<GridApi | null>(null);
  const applied = useRef(new Map<string, number>());
  const [rows, setRows] = useState<readonly MarketGridRow[]>(() => toGridRows(initial.quotes, initial.vndPerUsd));
  const [query, setQuery] = useState("");
  const vndPerUsd = initial.vndPerUsd;
  const visible = useMemo(() => filterGridRows(rows, query), [rows, query]);
  const [width, setWidth] = useState(0);
  const { columns, compact } = useMemo(() => marketColumns((href) => router.push(href), width), [router, width]);
  const live = useLiveQuotes();
  const liveRef = useRef(live);
  liveRef.current = live;

  // Mount the element once, sized to the viewport so it fits above the fold.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const grid = document.createElement("bo-grid") as BoGridElement;
    grid.style.display = "block";
    el.append(grid);
    element.current = grid;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => {
      observer.disconnect();
      grid.remove();
      element.current = null;
      api.current = null;
    };
  }, []);

  useEffect(() => {
    if (!element.current) return;
    const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, window.innerHeight - 280));
    // Rebuilt rows (search, minute refresh) start from the latest live prices, not the overview's.
    const appliedNow = new Map<string, number>();
    const withLive = visible.map((r) => {
      const quote = liveRef.current.get(r.symbol);
      if (!quote) return r;
      appliedNow.set(r.symbol, quote.priceUsd);
      return { ...r, ...livePatch(quote.priceUsd, vndPerUsd) };
    });
    applied.current = appliedNow;
    element.current.config = {
      columns,
      rows: withLive as unknown as NonNullable<BoGridElement["config"]>["rows"],
      height,
      rowHeight: 40,
      theme: compact ? { ...GRID_THEME, fontSize: "12px", cellPad: "6px" } : GRID_THEME,
      labels: GRID_LABELS,
      locale: "vi-VN",
      getRowId: (r) => (r as unknown as MarketGridRow).symbol,
      // A price board, not a spreadsheet: rows are links, cells aren't selectable.
      cellSelection: false,
      onRowClick: (r) => {
        router.push(`/tai-san/${(r as unknown as MarketGridRow).symbol.toLowerCase()}`);
      },
      onReady: (handle) => {
        api.current = handle as unknown as GridApi;
      },
      ariaLabel: "Bảng giá tham khảo các tài sản mã hóa, quy đổi VNĐ",
      emptyMessage: "Không có tài sản nào khớp. Thử mã khác, hoặc tài sản này chưa được niêm yết cặp USD trên ít nhất hai nguồn.",
    };
  }, [columns, compact, visible, router, vndPerUsd]);

  // Live prices: patch only changed rows (no re-render of the whole grid).
  useEffect(() => {
    const handle = api.current;
    if (!handle) return;
    const patches: [string, Record<string, unknown>][] = [];
    for (const [symbol, quote] of live) {
      if (applied.current.get(symbol) === quote.priceUsd) continue;
      applied.current.set(symbol, quote.priceUsd);
      patches.push([symbol, livePatch(quote.priceUsd, vndPerUsd)]);
    }
    if (patches.length > 0) handle.patchRows(patches);
  }, [live, vndPerUsd]);

  // Slow fields (24h change, volume, sources) from the overview, once a minute.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadQuotes()
        .then((next) => {
          if (next) setRows(toGridRows(next.quotes, vndPerUsd));
        })
        .catch(() => undefined);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [vndPerUsd]);

  return (
    <div data-testid="market-grid">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label htmlFor="market-grid-q" className="sr-only">
          Tìm theo mã hoặc tên tài sản
        </label>
        <input
          id="market-grid-q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 40))}
          placeholder="Tìm mã hoặc tên (BTC, Solana…)"
          autoComplete="off"
          className="min-w-0 flex-1 border border-outline-subtle bg-surface-lowest px-3 py-1.5 font-mono text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void api.current?.exportCSV("gia-tham-khao.csv")}
          className="border border-outline-subtle px-3 py-1.5 font-mono text-[12px] text-text-muted transition-colors duration-[var(--ds-duration-fast)] hover:text-accent focus-visible:text-accent"
        >
          Tải CSV
        </button>
        <p className="w-full font-mono text-[11px] text-text-muted" role="status">
          {query ? `${visible.length} kết quả cho “${query}”` : `${rows.length} tài sản`} · niêm yết cặp USD pháp định trên ≥ 2 nguồn · bấm tiêu đề cột để sắp
          xếp (không sắp xếp theo mức tăng/giảm)
        </p>
      </div>
      {/* data-lenis-prevent: the grid scrolls its own rows. */}
      <div ref={host} data-lenis-prevent className="ds-market-grid" />
    </div>
  );
}
