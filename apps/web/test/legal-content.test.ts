import { describe, expect, test } from "vitest";
import { LEGAL_CATEGORIES, LICENSING_STATUS, getInstrument, listInstruments, parseCategoryParam, parseInstrument, registerReviewedAt } from "@/lib/legal";

const VALID = `---
title: Văn bản thử
shortTitle: Thử
number: 1/2026/NĐ-CP
kind: Nghị định
issuer: Chính phủ
issuedAt: 2026-01-01
effectiveAt: 2026-02-01
category: thue
summary: Tóm tắt.
impacts:
  - Ảnh hưởng.
sources:
  - label: Nguồn
    url: https://example.gov.vn/a
---

Nội dung {{BRAND_NAME}}.
`;

describe("parseInstrument", () => {
  test("parses frontmatter, normalises YAML dates and interpolates the brand", () => {
    const doc = parseInstrument("thu", VALID);
    expect(doc.meta).toMatchObject({ number: "1/2026/NĐ-CP", issuedAt: "2026-01-01", effectiveAt: "2026-02-01", category: "thue" });
    expect(doc.body).toContain("Nội dung Averosi.");
  });

  test("rejects unknown categories, non-https sources and effective-before-issued", () => {
    expect(() => parseInstrument("x", VALID.replace("category: thue", "category: khac"))).toThrow();
    expect(() => parseInstrument("x", VALID.replace("https://example", "http://example"))).toThrow();
    expect(() => parseInstrument("x", VALID.replace("effectiveAt: 2026-02-01", "effectiveAt: 2025-12-01"))).toThrow();
  });

  test("requires at least one source", () => {
    const noSources = VALID.replace(/sources:[\s\S]*?---/, "sources: []\n---");
    expect(() => parseInstrument("x", noSources)).toThrow();
  });
});

describe("repository content/phap-ly", () => {
  test("every instrument is valid, slugs are unique, newest effective first", async () => {
    const items = await listInstruments();
    expect(items.length).toBeGreaterThanOrEqual(7);
    expect(new Set(items.map((i) => i.slug)).size).toBe(items.length);
    const dates = items.map((i) => i.meta.effectiveAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test("getInstrument finds by slug and rejects path tricks", async () => {
    expect((await getInstrument("nghi-dinh-284-2026-nd-cp"))?.meta.number).toBe("284/2026/NĐ-CP");
    expect(await getInstrument("../policies/dieu-khoan")).toBeNull();
    expect(await getInstrument("khong-co")).toBeNull();
  });
});

describe("categories & licensing status", () => {
  test("category query param is validated", () => {
    expect(parseCategoryParam("thue")).toBe("thue");
    expect(parseCategoryParam("bad")).toBeNull();
    expect(parseCategoryParam(undefined)).toBeNull();
    expect(Object.keys(LEGAL_CATEGORIES)).toEqual(["khung-phap-ly", "xu-phat", "thue", "du-lieu"]);
  });

  test("licensing status is dated and sourced", () => {
    expect(LICENSING_STATUS.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LICENSING_STATUS.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
  });
});

describe("registerReviewedAt", () => {
  test("reads the review date from docs/LEGAL_REGISTER.md", async () => {
    expect(await registerReviewedAt()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
