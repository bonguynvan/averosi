"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buildTerminalTheme } from "@/lib/chart/theme";
import { pricePrecisionFor } from "@/lib/chart/precision";
import type { Bar, Timeframe } from "@app/core";

const TIMEFRAMES: readonly { readonly value: Timeframe; readonly label: string }[] = [
  { value: "1h", label: "1 giờ" },
  { value: "1d", label: "1 ngày" },
];

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; source: string; bars: readonly Bar[] };

export function PriceChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/nen/${symbol}?tf=${timeframe}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { source: string; bars: Bar[] };
        setState({ status: "ready", source: body.source, bars: body.bars });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [symbol, timeframe]);

  useEffect(() => {
    const el = container.current;
    if (!el || state.status !== "ready") return;
    let chart: { setData(bars: Bar[]): void; setMarket(config: { type: "crypto"; pricePrecision: number }): void; destroy(): void; resize(): void } | null = null;
    let disposed = false;
    const observer = new ResizeObserver(() => chart?.resize());

    (async () => {
      const [{ Chart }, theme] = await Promise.all([import("@tradecanvas/chart"), buildTerminalTheme()]);
      if (disposed) return;
      chart = new Chart(el, {
        chartType: "candlestick",
        theme,
        autoScale: true,
        numberLocale: "vi-VN",
        // Read-only market view: no trading overlay, orders, drawings or indicators (LEGAL_REGISTER R1, R4).
        features: { trading: false, tradingContextMenu: false, drawings: false, indicators: false, volume: true },
      });
      chart.setMarket({ type: "crypto", pricePrecision: pricePrecisionFor(state.bars.at(-1)?.close ?? 0) });
      chart.setData([...state.bars]);
      observer.observe(el);
    })();

    return () => {
      disposed = true;
      observer.disconnect();
      chart?.destroy();
    };
  }, [state]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Khung thời gian" className="flex">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              aria-pressed={timeframe === tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`label-caps border border-outline-subtle px-3 py-1 ${
                timeframe === tf.value ? "bg-accent text-text-on-accent" : "text-text-muted hover:text-accent"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-4 font-mono text-[11px] text-text-muted">
          <span data-testid="chart-source">{state.status === "ready" ? `Nến ${symbol}/USD · nguồn ${state.source}` : " "}</span>
          <Link href={`/bieu-do?ma=${symbol}`} className="label-caps text-accent hover:underline">
            Mở biểu đồ đầy đủ →
          </Link>
        </span>
      </div>
      <div className="relative h-[420px] border border-outline-subtle bg-canvas" data-lenis-prevent>
        <div
          ref={container}
          className={`h-full w-full transition-opacity duration-[var(--ds-duration-slow)] ${state.status === "ready" ? "opacity-100" : "opacity-0"}`}
          data-testid="price-chart" aria-label={`Biểu đồ nến ${symbol}/USD`} role="img" />
        {state.status !== "ready" && (
          <p role="status" className="animate-fade absolute inset-0 flex items-center justify-center font-mono text-[12px] text-text-muted">
            {state.status === "loading" ? "Đang tải dữ liệu…" : "Không tải được dữ liệu biểu đồ. Không có số liệu thay thế."}
          </p>
        )}
      </div>
    </div>
  );
}
