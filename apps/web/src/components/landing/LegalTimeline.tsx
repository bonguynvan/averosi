import { legalStatus } from "@app/core";
import Link from "next/link";
import type { LegalInstrument } from "@/lib/legal";
import { LICENSING_STATUS } from "@/lib/legal";
import { StatusBadge } from "../legal/StatusBadge";

const vnDate = (iso: string) => iso.split("-").reverse().join("/");

/** Horizontal timeline of Vietnamese crypto law, oldest → newest, scrolling inside itself. */
export function LegalTimeline({ instruments, now }: { instruments: readonly LegalInstrument[]; now: Date }) {
  const ordered = [...instruments].reverse();
  return (
    <section aria-labelledby="legal-title" data-reveal className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="legal-title" className="font-mono text-[22px] leading-7 font-bold text-text">
            Pháp lý tài sản mã hóa tại Việt Nam
          </h2>
          <p className="mt-1 text-[14px] text-text-muted">Các mốc quan trọng, có ngày hiệu lực và nguồn chính thức.</p>
        </div>
        <Link href="/phap-ly" className="label-caps text-accent hover:underline">
          Xem tất cả →
        </Link>
      </div>

      <div className="scroll-fade-x overflow-x-auto pb-2" data-lenis-prevent-wheel>
        <ol className="flex w-max gap-0">
          {ordered.map((i) => (
            <li key={i.slug} className="relative w-64 snap-start pt-6 pr-4">
              <span aria-hidden="true" className="absolute top-2 right-0 left-0 h-px bg-outline" />
              <span aria-hidden="true" className="absolute top-0.5 left-0 h-3 w-3 rounded-led border border-accent bg-canvas" />
              <Link
                href={`/phap-ly/${i.slug}`}
                className="flex h-full flex-col gap-2 border border-outline-subtle bg-surface-low p-3 transition-colors duration-[var(--ds-duration-fast)] hover:border-accent"
              >
                <span className="flex items-center justify-between gap-2 font-mono text-[12px]">
                  <time dateTime={i.meta.effectiveAt} className="text-accent">
                    {vnDate(i.meta.effectiveAt)}
                  </time>
                  <StatusBadge status={legalStatus(i.meta, now)} />
                </span>
                <span className="font-mono text-[13px] font-semibold text-text">{i.meta.shortTitle}</span>
                <span className="font-mono text-[11px] text-text-muted">
                  {i.meta.kind} {i.meta.number}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <p className="border-l-2 border-warning bg-surface-low px-3 py-2 text-[13px] text-text-muted">
        <span className="font-mono font-semibold text-warning">Cấp phép sàn:</span> {LICENSING_STATUS.headline.toLowerCase()} (cập nhật{" "}
        {vnDate(LICENSING_STATUS.asOf)}).
      </p>
    </section>
  );
}
