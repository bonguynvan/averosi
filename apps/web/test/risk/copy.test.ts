import { findBannedCopy } from "@app/core";
import { describe, expect, test } from "vitest";
import { ERROR_COPY, FINDING_COPY, LEVEL_COPY } from "@/lib/risk/copy";

describe("risk copy", () => {
  test("every level and finding has non-empty Vietnamese copy", () => {
    for (const level of ["high", "medium", "low", "unknown"] as const) expect(LEVEL_COPY[level].label.length).toBeGreaterThan(0);
    for (const entry of Object.values(FINDING_COPY)) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.detail.length).toBeGreaterThan(0);
    }
    expect(Object.keys(ERROR_COPY).sort()).toEqual(["INVALID_ADDRESS", "RATE_LIMITED", "UNAVAILABLE", "UNSUPPORTED_CHAIN"]);
  });

  test("no level ever claims an address is safe, and no copy is banned", () => {
    const all = [...Object.values(LEVEL_COPY).flatMap((l) => [l.label, l.summary]), ...Object.values(FINDING_COPY).flatMap((f) => [f.title, f.detail])];
    expect(LEVEL_COPY.low.summary).toContain("không có nghĩa là địa chỉ an toàn");
    expect(all.filter((t) => /^an toàn$/i.test(t))).toEqual([]);
    expect(all.flatMap((t) => findBannedCopy(t))).toEqual([]);
  });
});
