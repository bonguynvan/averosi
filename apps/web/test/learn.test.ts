import { describe, expect, test } from "vitest";
import { getArticle, listArticles, parseArticle } from "@/lib/learn";

const VALID = `---
title: Bài thử
summary: Tóm tắt.
updatedAt: 2026-10-01
minutes: 4
tags: [an-toan]
related: [/rui-ro]
---

Nội dung {{BRAND_NAME}}.
`;

describe("parseArticle", () => {
  test("parses frontmatter and interpolates the brand", () => {
    const a = parseArticle("bai-thu", VALID);
    expect(a.meta).toMatchObject({ title: "Bài thử", updatedAt: "2026-10-01", minutes: 4, tags: ["an-toan"], related: ["/rui-ro"] });
    expect(a.body).toContain("Nội dung Averosi.");
  });

  test("related links must be internal paths; tags from the known set", () => {
    expect(() => parseArticle("x", VALID.replace("related: [/rui-ro]", "related: [https://example.com]"))).toThrow();
    expect(() => parseArticle("x", VALID.replace("tags: [an-toan]", "tags: [khac]"))).toThrow();
  });
});

describe("repository content/kien-thuc", () => {
  test("articles are valid, unique, newest first, and link only to existing internal routes", async () => {
    const items = await listArticles();
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(new Set(items.map((i) => i.slug)).size).toBe(items.length);
    const dates = items.map((i) => i.meta.updatedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    const known = ["/rui-ro", "/vi", "/thue", "/phap-ly", "/thi-truong", "/bieu-do", "/tai-san/btc"];
    for (const a of items) for (const r of a.meta.related) expect(known.some((k) => r === k || r.startsWith("/phap-ly/") || r.startsWith("/tai-san/"))).toBe(true);
  });

  test("getArticle rejects path tricks", async () => {
    expect(await getArticle("../policies/dieu-khoan")).toBeNull();
    expect(await getArticle("khong-co")).toBeNull();
  });
});
