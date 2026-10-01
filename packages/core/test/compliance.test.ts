import { describe, expect, test } from "vitest";
import { findBannedCopy, isReviewOverdue } from "../src/domain/compliance";

describe("findBannedCopy", () => {
  test("returns empty for factual copy", () => {
    expect(findBannedCopy("Khối lượng 24h tăng 240% so với trung bình 7 ngày.")).toEqual([]);
  });

  test("flags implied state supervision", () => {
    expect(findBannedCopy("Thông tư UBCKNN Giám sát")).toContainEqual(expect.objectContaining({ id: "implied-supervision" }));
  });

  test("flags investment advice regardless of case and diacritics casing", () => {
    expect(findBannedCopy("CHÚNG TÔI KHUYẾN NGHỊ MUA")).toContainEqual(expect.objectContaining({ id: "investment-advice" }));
    expect(findBannedCopy("Mua ngay kẻo lỡ")).toContainEqual(expect.objectContaining({ id: "call-to-trade" }));
  });

  test("flags OTC/USDT rates, fabricated status and referral links", () => {
    const ids = findBannedCopy("Tỷ giá USDT/VND OTC · Inst. Member · ?ref=abc").map((h) => h.id);
    expect(ids).toEqual(expect.arrayContaining(["otc-rate", "fabricated-status", "referral-link"]));
  });

  test("allows disclaimer sentences that negate advice", () => {
    expect(findBannedCopy("Không phải lời khuyên đầu tư, không khuyến nghị mua bán.")).toEqual([]);
  });
});

describe("isReviewOverdue", () => {
  test("false on or before the due date", () => {
    expect(isReviewOverdue("2026-10-31", new Date("2026-10-31T23:00:00Z"))).toBe(false);
  });

  test("true after the due date", () => {
    expect(isReviewOverdue("2026-10-31", new Date("2026-11-01T00:00:01Z"))).toBe(true);
  });

  test("throws on a malformed date so CI cannot silently pass", () => {
    expect(() => isReviewOverdue("31/10/2026", new Date())).toThrow("Invalid review date");
  });
});
