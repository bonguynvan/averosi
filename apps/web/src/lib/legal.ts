import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { sortByEffectiveDesc } from "@app/core";
import matter from "gray-matter";
import { z } from "zod";
import { BRAND, interpolateBrand } from "./brand";
import { REPO_ROOT } from "./paths";

const LEGAL_DIR = path.join(REPO_ROOT, "content/phap-ly");

export const LEGAL_CATEGORIES = {
  "khung-phap-ly": "Khung pháp lý",
  "xu-phat": "Xử phạt",
  thue: "Thuế",
  "du-lieu": "Dữ liệu cá nhân",
} as const;
export type LegalCategory = keyof typeof LEGAL_CATEGORIES;

const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
);

const InstrumentSchema = z
  .object({
    title: z.string().min(1),
    shortTitle: z.string().min(1),
    number: z.string().min(1),
    kind: z.enum(["Luật", "Nghị quyết", "Nghị định", "Thông tư"]),
    issuer: z.string().min(1),
    issuedAt: isoDate,
    effectiveAt: isoDate,
    expiresAt: isoDate.optional(),
    category: z.enum(Object.keys(LEGAL_CATEGORIES) as [LegalCategory, ...LegalCategory[]]),
    summary: z.string().min(1),
    impacts: z.array(z.string().min(1)).min(1),
    sources: z.array(z.object({ label: z.string().min(1), url: z.url().startsWith("https://") })).min(1),
  })
  .refine((m) => m.effectiveAt >= m.issuedAt, { message: "effectiveAt must not precede issuedAt" });

export type InstrumentMeta = z.infer<typeof InstrumentSchema>;

export interface LegalInstrument {
  readonly slug: string;
  readonly meta: InstrumentMeta;
  readonly body: string;
}

export function parseInstrument(slug: string, raw: string): LegalInstrument {
  const { data, content } = matter(interpolateBrand(raw, BRAND));
  const parsed = InstrumentSchema.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid frontmatter in content/phap-ly/${slug}.md: ${z.prettifyError(parsed.error)}`);
  return { slug, meta: parsed.data, body: content };
}

const SLUG = /^[a-z0-9-]+$/;

export async function listInstruments(): Promise<LegalInstrument[]> {
  const files = (await readdir(LEGAL_DIR)).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  const items = await Promise.all(
    files.map(async (f) => {
      const slug = f.slice(0, -3);
      return parseInstrument(slug, await readFile(path.join(LEGAL_DIR, f), "utf8"));
    }),
  );
  return sortByEffectiveDesc(items.map((i) => ({ ...i, issuedAt: i.meta.issuedAt, effectiveAt: i.meta.effectiveAt }))).map(
    ({ slug, meta, body }) => ({ slug, meta, body }),
  );
}

export async function getInstrument(slug: string): Promise<LegalInstrument | null> {
  if (!SLUG.test(slug)) return null;
  return (await listInstruments()).find((i) => i.slug === slug) ?? null;
}

export function parseCategoryParam(value: string | undefined): LegalCategory | null {
  return value !== undefined && value in LEGAL_CATEGORIES ? (value as LegalCategory) : null;
}

/** Last legal review date, from docs/LEGAL_REGISTER.md (single source of truth). */
export async function registerReviewedAt(): Promise<string> {
  const { data } = matter(await readFile(path.join(REPO_ROOT, "docs/LEGAL_REGISTER.md"), "utf8"));
  return isoDate.parse(data.reviewedAt);
}

/** Exchange licensing state. Update together with docs/LEGAL_REGISTER.md. */
export const LICENSING_STATUS = {
  asOf: "2026-10-01",
  headline: "Chưa có tổ chức nào được cấp phép chính thức",
  detail:
    "Bộ Tài chính đã đánh giá 5/7 hồ sơ đề nghị cấp phép tổ chức thị trường giao dịch tài sản mã hóa là hợp lệ (VIX, Lộc Phát, Việt Nam Thịnh Vượng, Techcom, CTCP Tài sản số Việt Nam). Theo thông tin công bố đến ngày cập nhật, chưa có giấy phép chính thức nào được cấp.",
  sources: [
    { label: "Vietstock — Bộ Tài chính duyệt 5/7 hồ sơ", url: "https://vietstock.vn/2026/03/bo-tai-chinh-duyet-57-ho-so-san-tai-san-ma-hoa-loai-2-ho-so-16312-1413953.htm" },
    { label: "VietNamNet — Sàn quốc tế sau ngày 1/9", url: "https://vietnamnet.vn/so-phan-cac-san-giao-dich-tai-san-ma-hoa-quoc-te-se-ra-sao-sau-ngay-1-9-2538660.html" },
  ],
} as const;
