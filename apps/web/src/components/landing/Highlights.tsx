import Link from "next/link";
import type { ReactNode } from "react";

export interface HighlightRow {
  readonly symbol: string;
  readonly primary: ReactNode;
  readonly secondary?: ReactNode;
}

interface HighlightCard {
  readonly title: string;
  readonly caption: string;
  readonly rows: readonly HighlightRow[];
}

/** Three factual highlight cards. Neutral framing: no "top gainers", no buy prompts. */
export function Highlights({ cards }: { cards: readonly HighlightCard[] }) {
  return (
    <section aria-label="Nổi bật 24 giờ" data-reveal className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.title} className="flex flex-col border border-outline-subtle bg-surface-low">
          <header className="border-b border-outline-subtle px-4 py-3">
            <h2 className="label-caps text-accent">{card.title}</h2>
            <p className="mt-1 text-[12px] text-text-muted">{card.caption}</p>
          </header>
          <ol className="flex-1 divide-y divide-outline-subtle">
            {card.rows.map((r, i) => (
              <li key={r.symbol}>
                <Link
                  href={`/tai-san/${r.symbol.toLowerCase()}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[13px] transition-colors duration-[var(--ds-duration-fast)] hover:bg-surface"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-4 text-text-muted">{i + 1}</span>
                    <span className="font-semibold text-text">{r.symbol}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span>{r.primary}</span>
                    {r.secondary && <span className="text-[11px] text-text-muted">{r.secondary}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}
