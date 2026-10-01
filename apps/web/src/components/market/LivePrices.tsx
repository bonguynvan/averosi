"use client";

import { formatVnd } from "@app/core";
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
    const source = new EventSource("/api/truc-tiep");
    source.onopen = () => setState((s) => ({ ...s, status: "live" }));
    source.onerror = () => setState((s) => ({ ...s, status: source.readyState === EventSource.CLOSED ? "offline" : "connecting" }));
    source.addEventListener("prices", (event) => {
      const updates = JSON.parse((event as MessageEvent<string>).data) as { symbol: string; priceUsd: number; at: number }[];
      setState((s) => {
        const quotes = new Map(s.quotes);
        for (const u of updates) quotes.set(u.symbol, { priceUsd: u.priceUsd, at: u.at });
        return { status: "live", quotes };
      });
    });
    return () => source.close();
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
  const text = quote && vndPerUsd ? formatVnd(BigInt(Math.round(quote.priceUsd * vndPerUsd))) : initial;

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
