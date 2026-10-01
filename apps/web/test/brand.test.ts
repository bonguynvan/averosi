import { describe, expect, test } from "vitest";
import { DEFAULT_BRAND, interpolateBrand, resolveBrand, splitWordmark } from "@/lib/brand";

describe("resolveBrand", () => {
  test("uses defaults when no env overrides are set", () => {
    expect(resolveBrand({})).toEqual(DEFAULT_BRAND);
  });

  test("env overrides name, site URL, repo and contact; contact defaults to the site host", () => {
    const brand = resolveBrand({ NEXT_PUBLIC_BRAND_NAME: "Sổ Cái", NEXT_PUBLIC_SITE_URL: "https://socai.vn" });
    expect(brand.name).toBe("Sổ Cái");
    expect(brand.siteUrl).toBe("https://socai.vn");
    expect(brand.contactEmail).toBe("privacy@socai.vn");
    expect(brand.sourceRepoUrl).toBe(DEFAULT_BRAND.sourceRepoUrl);
  });

  test("rejects an invalid site URL or email", () => {
    expect(() => resolveBrand({ NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow();
    expect(() => resolveBrand({ NEXT_PUBLIC_CONTACT_EMAIL: "nope" })).toThrow();
  });

  test("treats empty strings as unset", () => {
    expect(resolveBrand({ NEXT_PUBLIC_BRAND_NAME: "" }).name).toBe(DEFAULT_BRAND.name);
  });
});

describe("splitWordmark", () => {
  test("accents the last three letters of longer names", () => {
    expect(splitWordmark("Averosi")).toEqual({ lead: "AVER", accent: "OSI" });
  });

  test("short names are fully accented", () => {
    expect(splitWordmark("Xyz")).toEqual({ lead: "", accent: "XYZ" });
  });
});

describe("interpolateBrand", () => {
  test("replaces known placeholders", () => {
    expect(interpolateBrand("{{BRAND_NAME}} · {{SITE_HOST}} · {{CONTACT_EMAIL}}", DEFAULT_BRAND)).toBe(
      `${DEFAULT_BRAND.name} · ${new URL(DEFAULT_BRAND.siteUrl).host} · ${DEFAULT_BRAND.contactEmail}`,
    );
  });

  test("throws on unknown placeholders so typos never reach the page", () => {
    expect(() => interpolateBrand("{{BRAND}}", DEFAULT_BRAND)).toThrow("Unknown placeholder {{BRAND}}");
  });
});
