import { daysUntil, legalStatus } from "@app/core";
import Link from "next/link";
import { LEGAL_CATEGORIES, type LegalInstrument } from "@/lib/legal";
import { StatusBadge } from "./StatusBadge";

export const vnDate = (iso: string) => iso.split("-").reverse().join("/");

export function InstrumentCard({ instrument, now }: { instrument: LegalInstrument; now: Date }) {
  const { meta, slug } = instrument;
  const status = legalStatus(meta, now);
  const days = daysUntil(meta.effectiveAt, now);

  return (
    <article className="flex flex-col gap-3 border border-outline-subtle bg-surface-low p-4 transition-colors duration-[var(--ds-duration-fast)] hover:border-outline" data-testid="legal-card">
      <header className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
        <StatusBadge status={status} />
        <span className="text-text-muted">{LEGAL_CATEGORIES[meta.category]}</span>
        {status === "upcoming" && <span className="text-warning">còn {days} ngày</span>}
      </header>
      <div>
        <p className="font-mono text-[12px] text-accent-soft">
          {meta.kind} {meta.number} · {meta.issuer}
        </p>
        <h2 className="mt-1 font-mono text-[16px] leading-6 font-semibold text-text">
          <Link href={`/phap-ly/${slug}`} className="hover:text-accent">
            {meta.title}
          </Link>
        </h2>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 font-mono text-[12px]">
        <dt className="text-text-muted">Ban hành</dt>
        <dd>{vnDate(meta.issuedAt)}</dd>
        <dt className="text-text-muted">Hiệu lực</dt>
        <dd className="text-text">{vnDate(meta.effectiveAt)}</dd>
      </dl>
      <p className="text-[14px] leading-6 text-text-muted">{meta.summary}</p>
      <ul className="space-y-1 border-l-2 border-accent pl-3 text-[13px] leading-5 text-text">
        {meta.impacts.map((impact) => (
          <li key={impact}>{impact}</li>
        ))}
      </ul>
      <Link href={`/phap-ly/${slug}`} className="label-caps self-start text-accent hover:underline">
        Chi tiết & nguồn →
      </Link>
    </article>
  );
}
