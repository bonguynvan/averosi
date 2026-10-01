import { describe, expect, test } from "vitest";
import { type LegalInstrumentDates, daysUntil, legalStatus, sortByEffectiveDesc } from "../src/domain/legal";

const at = (iso: string) => new Date(`${iso}T12:00:00+07:00`);

describe("legalStatus (Vietnam time, inclusive effective date)", () => {
  const nd284: LegalInstrumentDates = { issuedAt: "2026-07-16", effectiveAt: "2026-09-01" };

  test("upcoming before the effective date", () => {
    expect(legalStatus(nd284, at("2026-08-31"))).toBe("upcoming");
  });

  test("in force from 00:00 UTC+7 on the effective date", () => {
    expect(legalStatus(nd284, new Date("2026-08-31T17:00:00Z"))).toBe("in-force"); // = 00:00 01/09 VN
    expect(legalStatus(nd284, new Date("2026-08-31T16:59:59Z"))).toBe("upcoming");
  });

  test("expired after expiresAt", () => {
    expect(legalStatus({ ...nd284, expiresAt: "2026-12-31" }, at("2027-01-01"))).toBe("expired");
    expect(legalStatus({ ...nd284, expiresAt: "2026-12-31" }, at("2026-12-31"))).toBe("in-force");
  });

  test("rejects malformed dates", () => {
    expect(() => legalStatus({ issuedAt: "x", effectiveAt: "2026-01-01" }, at("2026-01-01"))).toThrow("Invalid date");
  });
});

describe("daysUntil", () => {
  test("counts whole Vietnam calendar days", () => {
    expect(daysUntil("2026-09-01", at("2026-08-30"))).toBe(2);
    expect(daysUntil("2026-09-01", at("2026-09-01"))).toBe(0);
    expect(daysUntil("2026-09-01", at("2026-09-03"))).toBe(-2);
  });
});

describe("sortByEffectiveDesc", () => {
  test("newest effective first, ties by issue date, input not mutated", () => {
    const items = [
      { slug: "a", issuedAt: "2025-06-14", effectiveAt: "2026-01-01" },
      { slug: "b", issuedAt: "2025-09-09", effectiveAt: "2025-09-09" },
      { slug: "c", issuedAt: "2025-12-31", effectiveAt: "2026-01-01" },
    ];
    const copy = [...items];
    expect(sortByEffectiveDesc(items).map((i) => i.slug)).toEqual(["c", "a", "b"]);
    expect(items).toEqual(copy);
  });
});
