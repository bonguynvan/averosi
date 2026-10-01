import { daysUntil, legalStatus } from "@app/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { vnDate } from "@/components/legal/InstrumentCard";
import { LegalAside } from "@/components/legal/LegalAside";
import { StatusBadge } from "@/components/legal/StatusBadge";
import { Panel } from "@/components/ui/Panel";
import { Prose } from "@/components/ui/Prose";
import { LEGAL_CATEGORIES, getInstrument, registerReviewedAt } from "@/lib/legal";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = await getInstrument((await params).slug);
  return doc ? { title: `${doc.meta.kind} ${doc.meta.number}: ${doc.meta.shortTitle}`, description: doc.meta.summary } : {};
}

export default async function InstrumentPage({ params }: Props) {
  const doc = await getInstrument((await params).slug);
  if (!doc) notFound();
  const reviewedAt = await registerReviewedAt();
  const { meta } = doc;
  const now = new Date();
  const status = legalStatus(meta, now);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <article className="flex min-w-0 flex-col gap-4">
        <nav aria-label="Đường dẫn" className="font-mono text-[12px] text-text-muted">
          <Link href="/phap-ly" className="hover:text-accent">
            Pháp lý
          </Link>{" "}
          / <span className="text-text">{meta.number}</span>
        </nav>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
            <StatusBadge status={status} />
            <Link href={`/phap-ly?nhom=${meta.category}`} className="text-text-muted hover:text-accent">
              {LEGAL_CATEGORIES[meta.category]}
            </Link>
            {status === "upcoming" && <span className="text-warning">còn {daysUntil(meta.effectiveAt, now)} ngày</span>}
          </div>
          <p className="font-mono text-[13px] text-accent-soft">
            {meta.kind} {meta.number}
          </p>
          <h1 className="font-mono text-[22px] leading-8 font-bold text-text md:text-[26px]">{meta.title}</h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-[13px] sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-text-muted">Cơ quan</dt>
            <dd>{meta.issuer}</dd>
            <dt className="text-text-muted">Ban hành</dt>
            <dd>{vnDate(meta.issuedAt)}</dd>
            <dt className="text-text-muted">Hiệu lực</dt>
            <dd className="text-text">{vnDate(meta.effectiveAt)}</dd>
            {meta.expiresAt && (
              <>
                <dt className="text-text-muted">Hết hiệu lực</dt>
                <dd>{vnDate(meta.expiresAt)}</dd>
              </>
            )}
          </dl>
          <p className="text-[15px] leading-7 text-text-muted">{meta.summary}</p>
        </header>

        <Panel title="Ảnh hưởng tới người dùng">
          <ul className="space-y-2 text-[14px] leading-6 text-text">
            {meta.impacts.map((impact) => (
              <li key={impact} className="flex gap-2">
                <span aria-hidden="true" className="text-accent">
                  ▸
                </span>
                {impact}
              </li>
            ))}
          </ul>
        </Panel>

        <section className="border border-outline-subtle bg-surface-low p-4 md:p-6">
          <Prose markdown={doc.body} />
        </section>

        <Panel title="Nguồn">
          <ul className="space-y-1 font-mono text-[13px]" data-testid="legal-sources">
            {meta.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      </article>
      <LegalAside reviewedAt={reviewedAt} />
    </div>
  );
}
