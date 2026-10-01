import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import { Prose } from "@/components/ui/Prose";
import { LEARN_TAGS, getArticle, listArticles } from "@/lib/learn";

type Props = { params: Promise<{ slug: string }> };

const vnDate = (iso: string) => iso.split("-").reverse().join("/");

/** Human labels for internal tools an article can point to. */
const TOOL_LABELS: Record<string, string> = {
  "/rui-ro": "Trung tâm rủi ro",
  "/vi": "Theo dõi ví công khai",
  "/thue": "Công cụ thuế 0,1%",
  "/phap-ly": "Pháp lý crypto VN",
  "/bieu-do": "Biểu đồ kỹ thuật",
  "/thi-truong": "Thị trường",
};
const toolLabel = (href: string) =>
  TOOL_LABELS[href] ?? (href.startsWith("/phap-ly/") ? "Văn bản pháp luật liên quan" : href.startsWith("/tai-san/") ? "Ví dụ trên trang tài sản" : href);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  return a ? { title: a.meta.title, description: a.meta.summary } : {};
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();
  const others = (await listArticles()).filter((a) => a.slug !== article.slug).slice(0, 4);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <article className="flex min-w-0 max-w-3xl flex-col gap-4">
        <nav aria-label="Đường dẫn" className="font-mono text-[12px] text-text-muted">
          <Link href="/kien-thuc" className="hover:text-accent">
            Kiến thức
          </Link>{" "}
          / <span className="text-text">{article.meta.title}</span>
        </nav>
        <header className="flex flex-col gap-2">
          <p className="flex flex-wrap gap-2">
            {article.meta.tags.map((t) => (
              <Link key={t} href={`/kien-thuc?chu-de=${t}`} className="label-caps text-[10px] text-accent-soft hover:underline">
                {LEARN_TAGS[t]}
              </Link>
            ))}
          </p>
          <h1 className="font-mono text-[24px] leading-8 font-bold text-text md:text-[28px]">{article.meta.title}</h1>
          <p className="text-[16px] leading-7 text-text-muted">{article.meta.summary}</p>
          <p className="font-mono text-[11px] text-text-muted">
            {article.meta.minutes} phút đọc · cập nhật {vnDate(article.meta.updatedAt)}
          </p>
        </header>
        <section className="border border-outline-subtle bg-surface-low p-4 md:p-6" data-testid="article-body">
          <Prose markdown={article.body} />
        </section>
      </article>

      <aside className="flex flex-col gap-4" aria-label="Liên quan">
        {article.meta.related.length > 0 && (
          <Panel title="Công cụ liên quan">
            <ul className="space-y-1 font-mono text-[13px]">
              {article.meta.related.map((href) => (
                <li key={href}>
                  <Link href={href} className="text-accent hover:underline">
                    {toolLabel(href)} →
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel title="Bài khác">
          <ul className="space-y-2 text-[13px] leading-5">
            {others.map((a) => (
              <li key={a.slug}>
                <Link href={`/kien-thuc/${a.slug}`} className="text-text hover:text-accent">
                  {a.meta.title}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </aside>
    </div>
  );
}
