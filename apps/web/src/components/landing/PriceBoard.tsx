"use client";

import type { Sparkline as SparklineData } from "@app/core";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { MOTION, gsap, useGSAP } from "@/lib/motion/gsap";
import { Change } from "../market/Change";
import { Sparkline } from "./Sparkline";

export interface BoardRow {
  readonly symbol: string;
  readonly name: string;
  readonly priceVnd: string;
  readonly change24hBps: number | null;
  readonly spark: SparklineData | null;
}

interface PriceBoardProps {
  readonly tabs: readonly { readonly id: string; readonly label: string; readonly rows: readonly BoardRow[] }[];
  readonly updatedAt: string;
}

/** Hero price card (Binance-style tabs). Reference prices only — rows link to our own asset pages. */
export function PriceBoard({ tabs, updatedAt }: PriceBoardProps) {
  const id = useId();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const list = useRef<HTMLUListElement>(null);
  const firstRender = useRef(true);

  useGSAP(
    () => {
      if (firstRender.current) {
        firstRender.current = false;
        return;
      }
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("li", { opacity: 0, x: 12, duration: MOTION.normal, ease: MOTION.ease, stagger: MOTION.stagger, clearProps: "opacity,transform" });
      });
    },
    { scope: list, dependencies: [active] },
  );

  return (
    <div className="border border-outline bg-surface-lowest" data-testid="price-board">
      <div role="tablist" aria-label="Bảng giá tham khảo" className="flex border-b border-outline-subtle">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`${id}-${t.id}`}
            aria-selected={t.id === active}
            aria-controls={`${id}-panel`}
            onClick={() => setActive(t.id)}
            className={`label-caps px-4 py-3 transition-colors duration-[var(--ds-duration-fast)] ${
              t.id === active ? "border-b-2 border-accent text-accent" : "border-b-2 border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ul ref={list} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`} className="divide-y divide-outline-subtle">
        {current?.rows.map((r) => (
          <li key={r.symbol}>
            <Link
              href={`/tai-san/${r.symbol.toLowerCase()}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors duration-[var(--ds-duration-fast)] hover:bg-surface sm:grid-cols-[minmax(0,1fr)_96px_auto]"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-[14px] font-semibold text-text">{r.symbol}</span>
                <span className="truncate text-[12px] text-text-muted">{r.name}</span>
              </span>
              <span className="hidden sm:block">
                <Sparkline data={r.spark} />
              </span>
              <span className="flex flex-col items-end font-mono text-[13px]">
                <span className="text-text">{r.priceVnd}</span>
                <Change bps={r.change24hBps} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-outline-subtle px-4 py-2 font-mono text-[11px] text-text-muted">
        <span>Giá tham khảo · {updatedAt} (UTC+7)</span>
        <Link href="/thi-truong" className="text-accent hover:underline">
          Xem tất cả →
        </Link>
      </div>
    </div>
  );
}
