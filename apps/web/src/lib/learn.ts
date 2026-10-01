import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { BRAND, interpolateBrand } from "./brand";
import { REPO_ROOT } from "./paths";

const LEARN_DIR = path.join(REPO_ROOT, "content/kien-thuc");

export const LEARN_TAGS = {
  "an-toan": "An toàn",
  "lua-dao": "Lừa đảo",
  "phap-ly": "Pháp lý",
  thue: "Thuế",
  "du-lieu": "Đọc dữ liệu",
} as const;
export type LearnTag = keyof typeof LEARN_TAGS;

const isoDate = z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const ArticleSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  updatedAt: isoDate,
  minutes: z.number().int().positive().max(30),
  tags: z.array(z.enum(Object.keys(LEARN_TAGS) as [LearnTag, ...LearnTag[]])).min(1),
  /** Internal tools/pages this article explains (never external promotion). */
  related: z.array(z.string().regex(/^\/[a-z0-9/-]*$/, "internal path")).default([]),
});

export type ArticleMeta = z.infer<typeof ArticleSchema>;
export interface Article {
  readonly slug: string;
  readonly meta: ArticleMeta;
  readonly body: string;
}

export function parseArticle(slug: string, raw: string): Article {
  const { data, content } = matter(interpolateBrand(raw, BRAND));
  const parsed = ArticleSchema.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid frontmatter in content/kien-thuc/${slug}.md: ${z.prettifyError(parsed.error)}`);
  return { slug, meta: parsed.data, body: content };
}

export async function listArticles(): Promise<Article[]> {
  const files = (await readdir(LEARN_DIR)).filter((f) => f.endsWith(".md"));
  const items = await Promise.all(files.map(async (f) => parseArticle(f.slice(0, -3), await readFile(path.join(LEARN_DIR, f), "utf8"))));
  return items.sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt) || a.meta.title.localeCompare(b.meta.title, "vi"));
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return (await listArticles()).find((a) => a.slug === slug) ?? null;
}
