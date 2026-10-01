import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { BRAND, type Brand, interpolateBrand } from "./brand";
import { POLICIES_DIR } from "./paths";

export const POLICY_SLUGS = ["mien-tru-trach-nhiem", "dieu-khoan", "quyen-rieng-tu"] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

// YAML parses bare dates into Date objects; normalise back to YYYY-MM-DD.
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
);

const PolicyMetaSchema = z
  .object({
    title: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "expected semver"),
    effectiveDate: isoDate,
    updatedAt: isoDate,
    status: z.string().min(1),
  })
  .refine((m) => m.updatedAt >= m.effectiveDate, { message: "updatedAt must not precede effectiveDate" });

export type PolicyMeta = z.infer<typeof PolicyMetaSchema>;

export interface Policy {
  readonly slug: PolicySlug;
  readonly meta: PolicyMeta;
  readonly body: string;
}

export function parsePolicy(slug: PolicySlug, raw: string, brand: Brand = BRAND): Policy {
  const { data, content } = matter(interpolateBrand(raw, brand));
  const parsed = PolicyMetaSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid frontmatter in content/policies/${slug}.md: ${z.prettifyError(parsed.error)}`);
  }
  return { slug, meta: parsed.data, body: content };
}

function isPolicySlug(slug: string): slug is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(slug);
}

export async function loadPolicy(slug: string): Promise<Policy | null> {
  if (!isPolicySlug(slug)) return null;
  const raw = await readFile(path.join(POLICIES_DIR, `${slug}.md`), "utf8");
  return parsePolicy(slug, raw);
}

export async function loadAllPolicies(): Promise<Policy[]> {
  return Promise.all(POLICY_SLUGS.map(async (slug) => parsePolicy(slug, await readFile(path.join(POLICIES_DIR, `${slug}.md`), "utf8"))));
}
