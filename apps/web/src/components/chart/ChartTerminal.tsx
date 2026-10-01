"use client";

import { useEffect, useRef, useState } from "react";
import { buildTerminalTheme } from "@/lib/chart/theme";
import { pricePrecisionFor } from "@/lib/chart/precision";
import { fetchProxyBars } from "@/lib/chart/proxyBars";
import { type QuoteDto, toWatchlistUpdates } from "@/lib/chart/watchlist";
import { CANDLE_TIMEFRAMES } from "@app/core";

const POLL_MS = 15_000;
const HISTORY_LIMIT = 300;
const WATCHLIST_REFRESH_MS = 60_000;

type WatchlistTarget = { setWatchlistEntry(symbol: string, entry: { lastPrice?: number; refPrice?: number }): void };
type MarketTarget = { getChart(): { setMarket(config: { type: "crypto"; pricePrecision: number }): void } };

/** Feed the widget watchlist from our aggregated reference quotes (one request for all symbols). */
async function refreshWatchlist(widget: WatchlistTarget): Promise<void> {
  const res = await fetch("/api/thi-truong", { headers: { accept: "application/json" } });
  if (!res.ok) return;
  const { quotes } = (await res.json()) as { quotes: QuoteDto[] };
  for (const { symbol, ...entry } of toWatchlistUpdates(quotes)) widget.setWatchlistEntry(symbol, entry);
}

interface ChartTerminalProps {
  readonly symbol: string;
  readonly symbols: readonly string[];
}

type Status = "loading" | "ready" | "error";

/**
 * Full tradecanvas ChartWidget (toolbar, indicators, drawings, chart types, settings, watchlist,
 * alerts, replay, screenshots) in a read-only configuration: no trading overlay, orders or depth ladder.
 * Data comes only from our proxy via a PollingAdapter.
 */
export function ChartTerminal({ symbol, symbols }: ChartTerminalProps) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let widget: ({ destroy(): void } & WatchlistTarget & MarketTarget) | null = null;
    let precision = -1;
    // Price line, crosshair and alerts use a fixed precision: follow the symbol's price magnitude.
    const followPrecision = (price: number | undefined) => {
      const next = pricePrecisionFor(price ?? 0);
      if (!widget || next === precision) return;
      precision = next;
      widget.getChart().setMarket({ type: "crypto", pricePrecision: next });
    };
    let disposed = false;
    let watchlistTimer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const [{ ChartWidget }, { PollingAdapter }, theme] = await Promise.all([
          import("@tradecanvas/chart/widget"),
          import("@tradecanvas/chart"),
          buildTerminalTheme(),
        ]);
        if (disposed) return;
        const adapter = new PollingAdapter({
          name: "ds-proxy",
          fetchBars: async (sym, tf, limit) => {
            const bars = await fetchProxyBars(fetch, sym, tf, limit);
            followPrecision(bars.at(-1)?.close);
            return bars;
          },
          intervalMs: POLL_MS,
          pollLimit: 3,
          defaultHistoryLimit: HISTORY_LIMIT,
        });
        widget = new ChartWidget(el, {
          symbol,
          symbols: [...symbols],
          timeframe: "1h",
          timeframes: [...CANDLE_TIMEFRAMES],
          theme,
          adapter,
          historyLimit: HISTORY_LIMIT,
          toolbar: true,
          drawingTools: true,
          settings: true,
          statusBar: true,
          watchlist: true,
          objectTree: true,
          alerts: true,
          alertNotifications: { sound: false, desktop: false },
          shareUrl: true,
          persistLayouts: { keyPrefix: "ds-chart:layout:" },
          dragDropImport: true,
          // Read-only: no trading overlay, order placement or depth ladder (LEGAL_REGISTER R1, R2).
          trading: false,
          depthLadder: false,
          chartOptions: { numberLocale: "vi-VN" },
          onSymbolChange: (next) => {
            const url = new URL(window.location.href);
            url.searchParams.set("ma", next);
            window.history.replaceState(window.history.state, "", url);
          },
          onReady: () => setStatus("ready"),
        });
        const target = widget;
        const tick = () => void refreshWatchlist(target).catch(() => undefined);
        tick();
        watchlistTimer = setInterval(tick, WATCHLIST_REFRESH_MS);
      } catch {
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      clearInterval(watchlistTimer);
      widget?.destroy();
    };
    // Mount once: the widget owns symbol/timeframe switching afterwards; re-creating it would drop user state.
  }, []); // intentionally empty

  return (
    <div className="ds-chart relative h-full min-h-[480px] w-full bg-canvas">
      {/* data-lenis-prevent: wheel/trackpad zooms and pans the chart instead of scrolling the page. */}
      <div ref={host} data-lenis-prevent data-testid="chart-terminal" className="absolute inset-0" />
      {status !== "ready" && (
        <p role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[12px] text-text-muted">
          {status === "loading" ? "Đang tải biểu đồ…" : "Không tải được biểu đồ. Không có số liệu thay thế."}
        </p>
      )}
    </div>
  );
}
