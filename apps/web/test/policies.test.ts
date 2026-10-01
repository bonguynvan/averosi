import { describe, expect, test } from "vitest";
import { POLICY_SLUGS, loadAllPolicies, loadPolicy, parsePolicy } from "@/lib/policies";

const VALID = `---
title: Thử
version: 1.2.3
effectiveDate: 2026-10-01
updatedAt: 2026-10-02
status: draft
---

# Nội dung
`;

describe("parsePolicy", () => {
  test("parses frontmatter and body", () => {
    const policy = parsePolicy("mien-tru-trach-nhiem", VALID);
    expect(policy.meta).toEqual({
      title: "Thử",
      version: "1.2.3",
      effectiveDate: "2026-10-01",
      updatedAt: "2026-10-02",
      status: "draft",
    });
    expect(policy.body.trim()).toBe("# Nội dung");
  });

  test("rejects missing version", () => {
    const bad = VALID.replace("version: 1.2.3\n", "");
    expect(() => parsePolicy("dieu-khoan", bad)).toThrow(/dieu-khoan/);
  });

  test("rejects non-semver version and non-ISO dates", () => {
    expect(() => parsePolicy("dieu-khoan", VALID.replace("1.2.3", "v1"))).toThrow();
    expect(() => parsePolicy("dieu-khoan", VALID.replace("2026-10-02", "02/10/2026"))).toThrow();
  });

  test("rejects updatedAt earlier than effectiveDate", () => {
    expect(() => parsePolicy("dieu-khoan", VALID.replace("updatedAt: 2026-10-02", "updatedAt: 2026-09-01"))).toThrow();
  });
});

describe("repository policies", () => {
  test("every required policy exists and is valid", async () => {
    const policies = await loadAllPolicies();
    expect(policies.map((p) => p.slug)).toEqual([...POLICY_SLUGS]);
  });

  test("loadPolicy loads a known slug", async () => {
    const policy = await loadPolicy("quyen-rieng-tu");
    expect(policy?.meta.title).toBe("Chính sách quyền riêng tư");
  });

  test("loadPolicy returns null for unknown slugs", async () => {
    expect(await loadPolicy("khong-ton-tai")).toBeNull();
  });
});
