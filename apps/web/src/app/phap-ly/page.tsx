import { legalStatus } from "@app/core";
import type { Metadata } from "next";
import Link from "next/link";
import { InstrumentCard, vnDate } from "@/components/legal/InstrumentCard";
import { LegalAside } from "@/components/legal/LegalAside";
import { LEGAL_CATEGORIES, type LegalCategory, listInstruments, parseCategoryParam, registerReviewedAt } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Pháp lý tài sản mã hóa Việt Nam",
  description:
    "Tổng hợp văn bản pháp luật về tài sản mã hóa tại Việt Nam: Nghị quyết 05/2025/NQ-CP, Nghị định 284/2026/NĐ-CP, thuế 0,1%, bảo vệ dữ liệu cá nhân. Ngày hiệu lực và nguồn chính thức.",
};

type Props = { searchParams: Promise<{ nhom?: string }> };

function FilterLink({ value, label, active }: { value: LegalCategory | null; label: string; active: boolean }) {
  return (
    <Link
      href={value ? `/phap-ly?nhom=${value}` : "/phap-ly"}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={`label-caps border px-3 py-1.5 transition-colors duration-[var(--ds-duration-fast)] ${
        active ? "border-accent bg-accent text-text-on-accent" : "border-outline-subtle text-text-muted hover:border-accent hover:text-accent"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function LegalTrackerPage({ searchParams }: Props) {
  const category = parseCategoryParam((await searchParams).nhom);
  const [all, reviewedAt] = await Promise.all([listInstruments(), registerReviewedAt()]);
  const now = new Date();
  const items = category ? all.filter((i) => i.meta.category === category) : all;
  const inForce = all.filter((i) => legalStatus(i.meta, now) === "in-force").length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-col gap-2">
          <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Pháp lý tài sản mã hóa tại Việt Nam</h1>
          <p className="max-w-2xl text-[14px] leading-6 text-text-muted">
            Văn bản liên quan đến tài sản mã hóa, thuế và dữ liệu cá nhân, kèm ngày hiệu lực, tác động thực tế và nguồn chính thức.
          </p>
          <p className="font-mono text-[12px] text-text-muted">
            {all.length} văn bản · {inForce} đang hiệu lực · rà soát {vnDate(reviewedAt)}
          </p>
        </header>

        <nav aria-label="Lọc theo nhóm" className="flex flex-wrap gap-2">
          <FilterLink value={null} label="Tất cả" active={category === null} />
          {(Object.entries(LEGAL_CATEGORIES) as [LegalCategory, string][]).map(([value, label]) => (
            <FilterLink key={value} value={value} label={label} active={category === value} />
          ))}
        </nav>

        <ol className="flex flex-col gap-4" data-testid="legal-list">
          {items.map((i) => (
            <li key={i.slug} className="animate-enter">
              <InstrumentCard instrument={i} now={now} />
            </li>
          ))}
        </ol>
      </div>
      <LegalAside reviewedAt={reviewedAt} />
    </div>
  );
}
