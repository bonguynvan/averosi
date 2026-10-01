import { describe, expect, test } from "vitest";
import { type Change, analyze, parseAgentResponse } from "../src/analyze";
import { STATE } from "./fixtures";

const response = (findings: unknown, results: unknown[] = []) => ({
  output: [
    { type: "message", role: "assistant", content: JSON.stringify(findings) },
    { type: "search_results", results },
  ],
  output_text: JSON.stringify(findings),
});

const NEW_DECREE: Change = {
  type: "new" as const,
  number: "999/2026/NĐ-CP",
  title: "Nghị định thử",
  issuer: "Chính phủ",
  issuedAt: "2026-10-05",
  effectiveAt: "2026-11-20",
  summary: "Tóm tắt",
  impact: "Ảnh hưởng",
  sourceUrls: ["https://chinhphu.vn/a"],
};

describe("parseAgentResponse", () => {
  test("parses findings JSON and collects search-result citations", () => {
    const parsed = parseAgentResponse(
      response({ changes: [NEW_DECREE], licensing: { anyLicensed: false, summary: "Chưa", sourceUrls: [] } }, [
        { url: "https://chinhphu.vn/a", title: "A", date: "2026-10-05" },
      ]),
    );
    expect(parsed.findings.changes).toHaveLength(1);
    expect(parsed.citations).toEqual([{ url: "https://chinhphu.vn/a", title: "A", date: "2026-10-05" }]);
  });

  test("tolerates a fenced JSON answer", () => {
    const text = "```json\n" + JSON.stringify({ changes: [], licensing: { anyLicensed: false, summary: "", sourceUrls: [] } }) + "\n```";
    const parsed = parseAgentResponse({ output: [], output_text: text });
    expect(parsed.findings.changes).toEqual([]);
  });

  test("rejects malformed findings and non-https sources", () => {
    expect(() => parseAgentResponse({ output: [], output_text: "not json" })).toThrow();
    const bad = { changes: [{ ...NEW_DECREE, sourceUrls: ["http://x.vn"] }], licensing: { anyLicensed: false, summary: "", sourceUrls: [] } };
    expect(() => parseAgentResponse(response(bad))).toThrow();
  });
});

describe("analyze", () => {
  const base = { anyLicensed: false, summary: "", sourceUrls: [] };

  test("drops changes already in the tracker (by number), keeps amendments", () => {
    const known = { ...NEW_DECREE, number: "284/2026/NĐ-CP", type: "new" as const };
    const amended = { ...NEW_DECREE, number: "32/2026/TT-BTC", type: "amended" as const };
    const result = analyze(STATE, { changes: [NEW_DECREE, known, amended], licensing: base }, "2026-10-08");
    expect(result.newChanges.map((c) => c.number)).toEqual(["999/2026/NĐ-CP", "32/2026/TT-BTC"]);
    expect(result.needsAttention).toBe(true);
  });

  test("flags a licensing change when the first exchange is licensed", () => {
    const result = analyze(STATE, { changes: [], licensing: { anyLicensed: true, summary: "VIX được cấp phép", sourceUrls: ["https://mof.gov.vn/x"] } }, "2026-10-08");
    expect(result.licensingChanged).toBe(true);
    expect(result.needsAttention).toBe(true);
  });

  test("flags an approaching review deadline even without changes", () => {
    expect(analyze(STATE, { changes: [], licensing: base }, "2026-10-08").needsAttention).toBe(false);
    const soon = analyze(STATE, { changes: [], licensing: base }, "2026-10-26");
    expect(soon.reviewDueInDays).toBe(5);
    expect(soon.needsAttention).toBe(true);
  });

  test("number matching ignores spacing and case", () => {
    const variant = { ...NEW_DECREE, number: " 284/2026/nđ-cp " };
    expect(analyze(STATE, { changes: [variant], licensing: base }, "2026-10-08").newChanges).toEqual([]);
  });
});
