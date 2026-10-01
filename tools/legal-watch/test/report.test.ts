import { describe, expect, test } from "vitest";
import { buildIssue } from "../src/report";
import { STATE } from "./fixtures";

describe("buildIssue", () => {
  const change = {
    type: "new" as const,
    number: "999/2026/NĐ-CP",
    title: "Nghị định thử",
    issuer: "Chính phủ",
    issuedAt: "2026-10-05",
    effectiveAt: "2026-11-20",
    summary: "Tóm tắt",
    impact: "Ảnh hưởng tới người dùng",
    sourceUrls: ["https://chinhphu.vn/a"],
  };

  test("renders changes, citations and a verification checklist", () => {
    const issue = buildIssue({
      state: STATE,
      today: "2026-10-08",
      analysis: { newChanges: [change], licensingChanged: false, reviewDueInDays: 23, needsAttention: true },
      licensingSummary: "Chưa có thay đổi",
      citations: [{ url: "https://chinhphu.vn/a", title: "A", date: "2026-10-05" }],
      preset: "low",
    });
    expect(issue.title).toBe("Rà soát pháp lý 2026-10-08: 1 thay đổi cần xác minh");
    expect(issue.body).toContain("999/2026/NĐ-CP");
    expect(issue.body).toContain("https://chinhphu.vn/a");
    expect(issue.body).toContain("- [ ] Đối chiếu văn bản gốc");
    expect(issue.body).toContain("docs/LEGAL_REGISTER.md");
    expect(issue.body).toContain("content/phap-ly");
    expect(issue.body).toMatch(/AI.*không phải nguồn/i);
  });

  test("licensing change gets its own headline", () => {
    const issue = buildIssue({
      state: STATE,
      today: "2026-10-08",
      analysis: { newChanges: [], licensingChanged: true, reviewDueInDays: 23, needsAttention: true },
      licensingSummary: "VIX được cấp phép",
      citations: [],
      preset: "low",
    });
    expect(issue.title).toBe("Rà soát pháp lý 2026-10-08: tình trạng cấp phép sàn thay đổi");
    expect(issue.body).toContain("_cap-phep.json");
  });

  test("review reminder when nothing changed but the deadline is close", () => {
    const issue = buildIssue({
      state: STATE,
      today: "2026-10-26",
      analysis: { newChanges: [], licensingChanged: false, reviewDueInDays: 5, needsAttention: true },
      licensingSummary: "",
      citations: [],
      preset: "low",
    });
    expect(issue.title).toBe("Rà soát pháp lý 2026-10-26: đến hạn rà soát sau 5 ngày");
  });
});
