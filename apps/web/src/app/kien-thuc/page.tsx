import type { Metadata } from "next";
import Link from "next/link";
import { LEARN_TAGS, type LearnTag, listArticles } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Kiến thức",
  description: "Hướng dẫn tự bảo vệ tài sản số, nhận diện lừa đảo, pháp lý và thuế tài sản mã hóa tại Việt Nam, cách đọc chỉ báo kỹ thuật.",
};

type Props = { searchParams: Promise<{ "chu-de"?: string }> };

const vnDate = (iso: string) => iso.split("-").reverse().join("/");

export default async function LearnPage({ searchParams }: Props) {
  const raw = (await searchParams)["chu-de"];
  const tag = raw && raw in LEARN_TAGS ? (raw as LearnTag) : null;
  const all = await listArticles();
  const items = tag ? all.filter((a) => a.meta.tags.includes(tag)) : all;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Kiến thức</h1>
        <p className="max-w-2xl text-[15px] leading-7 text-text-muted">
          Tự bảo vệ tài sản số và hiểu đúng quy định. Nội dung giáo dục, không giới thiệu tài sản hay nền tảng giao dịch nào.
        </p>
      </header>

      <nav aria-label="Chủ đề" className="flex flex-wrap gap-2">
        {[{ value: null, label: "Tất cả" }, ...(Object.entries(LEARN_TAGS) as [LearnTag, string][]).map(([value, label]) => ({ value, label }))].map((t) => (
          <Link
            key={t.label}
            href={t.value ? `/kien-thuc?chu-de=${t.value}` : "/kien-thuc"}
            scroll={false}
            aria-current={tag === t.value ? "page" : undefined}
            className={`label-caps border px-3 py-1.5 transition-colors duration-[var(--ds-duration-fast)] ${
              tag === t.value ? "border-accent bg-accent text-text-on-accent" : "border-outline-subtle text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <ul className="grid gap-4 md:grid-cols-2" data-testid="article-list">
        {items.map((a) => (
          <li key={a.slug} data-reveal>
            <Link
              href={`/kien-thuc/${a.slug}`}
              className="group flex h-full flex-col gap-3 border border-outline-subtle bg-surface-low p-5 transition-colors duration-[var(--ds-duration-fast)] hover:border-accent"
            >
              <span className="flex flex-wrap gap-2">
                {a.meta.tags.map((t) => (
                  <span key={t} className="label-caps text-[10px] text-accent-soft">
                    {LEARN_TAGS[t]}
                  </span>
                ))}
              </span>
              <span className="font-mono text-[16px] leading-6 font-semibold text-text group-hover:text-accent">{a.meta.title}</span>
              <span className="text-[14px] leading-6 text-text-muted">{a.meta.summary}</span>
              <span className="mt-auto font-mono text-[11px] text-text-muted">
                {a.meta.minutes} phút đọc · cập nhật {vnDate(a.meta.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
