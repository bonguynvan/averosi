"use client";

import { formatVndPrice } from "@app/core";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { MOTION, gsap, prefersReducedMotion } from "@/lib/motion/gsap";

interface LiveQuote {
  readonly priceUsd: number;
  readonly at: number;
}

interface LiveState {
  readonly status: "connecting" | "live" | "offline";
  readonly quotes: ReadonlyMap<string, LiveQuote>;
}

const LiveContext = createContext<LiveState>({ status: "offline", quotes: new Map() });

/** One same-origin EventSource per page; children read prices via useLiveQuote. */
export function LivePricesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ status: "connecting", quotes: new Map() });

  useEffect(() => {
    // EventSource retries dropped connections itself, but gives up for good on HTTP errors (429/5xx).
    // Re-open with backoff so a restart or a brief limit never leaves the page permanently offline.
    const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000];
    let source: EventSource | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const open = () => {
      if (disposed) return;
      const es = new EventSource("/api/truc-tiep");
      source = es;
      es.onopen = () => {
        attempt = 0;
        setState((s) => ({ ...s, status: "live" }));
      };
      es.onerror = () => {
        if (es.readyState !== EventSource.CLOSED) {
          setState((s) => ({ ...s, status: "connecting" }));
          return;
        }
        es.close();
        setState((s) => ({ ...s, status: attempt >= BACKOFF_MS.length ? "offline" : "connecting" }));
        timer = setTimeout(open, BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
        attempt += 1;
      };
      es.addEventListener("prices", (event) => {
        const updates = JSON.parse((event as MessageEvent<string>).data) as { symbol: string; priceUsd: number; at: number }[];
        setState((s) => {
          const quotes = new Map(s.quotes);
          for (const u of updates) quotes.set(u.symbol, { priceUsd: u.priceUsd, at: u.at });
          return { status: "live", quotes };
        });
      });
    };

    open();
    return () => {
      disposed = true;
      clearTimeout(timer);
      source?.close();
    };
  }, []);

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export const useLiveStatus = () => useContext(LiveContext).status;
export const useLiveQuote = (symbol: string) => useContext(LiveContext).quotes.get(symbol);

/** Status chip: "● Trực tiếp" while streaming. */
export function LiveBadge() {
  const status = useLiveStatus();
  const label = status === "live" ? "Trực tiếp" : status === "connecting" ? "Đang kết nối" : "Ngoại tuyến";
  return (
    <span className="label-caps flex items-center gap-1.5 text-text-muted" data-testid="live-badge" data-status={status}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-led ${status === "live" ? "animate-pulse bg-success motion-reduce:animate-none" : "bg-outline"}`} />
      {label}
    </span>
  );
}

/**
 * VND price that follows the live stream (server-rendered value first), flashing up/down on change.
 * Conversion uses the page's FX rate (Vietcombank), same as the server-side table.
 */
export function LiveVndPrice({ symbol, initial, vndPerUsd, className }: { symbol: string; initial: string; vndPerUsd: number | null; className?: string }) {
  const quote = useLiveQuote(symbol);
  const el = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(null);
  // nano-dong, so sub-dong prices (PEPE ≈ 0,23 ₫) keep their significant digits.
  const text = quote && vndPerUsd ? formatVndPrice(BigInt(Math.round(quote.priceUsd * vndPerUsd * 1e9))) : initial;

  useEffect(() => {
    if (!quote) return;
    const prev = previous.current;
    previous.current = quote.priceUsd;
    if (prev === null || prev === quote.priceUsd || !el.current || prefersReducedMotion()) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue(quote.priceUsd > prev ? "--ds-color-up" : "--ds-color-down").trim();
    gsap.fromTo(el.current, { color }, { color: "", duration: MOTION.slow * 3, ease: "power2.out", overwrite: "auto", clearProps: "color" });
  }, [quote]);

  return (
    <span ref={el} className={className} data-live-symbol={symbol}>
      {text}
    </span>
  );
}
