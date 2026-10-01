import { z } from "zod";

/**
 * The ONLY place the product name, domain, repo and contact live.
 * "Averosi" / averosi.com is a working name: rebrand by changing the defaults below
 * or setting NEXT_PUBLIC_* env vars at build time. Content files use {{PLACEHOLDERS}}.
 */
export interface Brand {
  readonly name: string;
  readonly siteUrl: string;
  readonly sourceRepoUrl: string;
  readonly contactEmail: string;
}

export const DEFAULT_BRAND: Brand = {
  name: "Averosi",
  siteUrl: "https://averosi.com",
  sourceRepoUrl: "https://github.com/bonguynvan/averosi",
  contactEmail: "privacy@averosi.com",
};

const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const BrandEnvSchema = z.object({
  NEXT_PUBLIC_BRAND_NAME: optional(z.string().min(1)),
  NEXT_PUBLIC_SITE_URL: optional(z.url()),
  NEXT_PUBLIC_SOURCE_REPO_URL: optional(z.url()),
  NEXT_PUBLIC_CONTACT_EMAIL: optional(z.email()),
});

export type BrandEnv = Partial<Record<keyof z.infer<typeof BrandEnvSchema>, string>>;

export function resolveBrand(env: BrandEnv): Brand {
  const parsed = BrandEnvSchema.parse(env);
  const siteUrl = parsed.NEXT_PUBLIC_SITE_URL ?? DEFAULT_BRAND.siteUrl;
  const siteChanged = siteUrl !== DEFAULT_BRAND.siteUrl;
  return {
    name: parsed.NEXT_PUBLIC_BRAND_NAME ?? DEFAULT_BRAND.name,
    siteUrl,
    sourceRepoUrl: parsed.NEXT_PUBLIC_SOURCE_REPO_URL ?? DEFAULT_BRAND.sourceRepoUrl,
    contactEmail: parsed.NEXT_PUBLIC_CONTACT_EMAIL ?? (siteChanged ? `privacy@${new URL(siteUrl).host}` : DEFAULT_BRAND.contactEmail),
  };
}

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them into client bundles.
export const BRAND: Brand = resolveBrand({
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SOURCE_REPO_URL: process.env.NEXT_PUBLIC_SOURCE_REPO_URL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
} as BrandEnv);

const ACCENT_LENGTH = 3;

/** Logo wordmark: last three letters in the accent colour (AVER·OSI). */
export function splitWordmark(name: string): { lead: string; accent: string } {
  const upper = name.toUpperCase();
  if (upper.length <= ACCENT_LENGTH + 1) return { lead: "", accent: upper };
  return { lead: upper.slice(0, -ACCENT_LENGTH), accent: upper.slice(-ACCENT_LENGTH) };
}

/** Replaces {{BRAND_NAME}}, {{SITE_HOST}}, {{SITE_URL}}, {{CONTACT_EMAIL}}, {{SOURCE_REPO_URL}} in content. */
export function interpolateBrand(text: string, brand: Brand): string {
  const values: Record<string, string> = {
    BRAND_NAME: brand.name,
    SITE_URL: brand.siteUrl,
    SITE_HOST: new URL(brand.siteUrl).host,
    CONTACT_EMAIL: brand.contactEmail,
    SOURCE_REPO_URL: brand.sourceRepoUrl,
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Unknown placeholder ${placeholder}`);
    return value;
  });
}
