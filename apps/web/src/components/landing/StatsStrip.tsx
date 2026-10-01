import type { ReactNode } from "react";

export interface Stat {
  readonly label: string;
  readonly value: ReactNode;
  readonly note?: string;
}

/** CoinMarketCap-style headline metrics; scrolls inside itself on small screens. */
export function StatsStrip({ stats }: { stats: readonly Stat[] }) {
  return (
    <section aria-label="Chỉ số tổng quan" className="scroll-fade-x overflow-x-auto border border-outline-subtle bg-surface-lowest md:[mask-image:none]">
      <dl className="flex w-max min-w-full divide-x divide-outline-subtle">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-44 flex-1 snap-start flex-col gap-1 px-4 py-3">
            <dt className="label-caps text-text-muted">{s.label}</dt>
            <dd className="font-mono text-[16px] font-semibold text-text">{s.value}</dd>
            {s.note && <dd className="font-mono text-[11px] text-text-muted">{s.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
