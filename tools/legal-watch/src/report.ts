import type { Analysis, Change, Citation } from "./analyze";
import type { KnownState } from "./state";

const TYPE_LABEL: Record<Change["type"], string> = {
  new: "Mới",
  amended: "Sửa đổi",
  repealed: "Bãi bỏ",
  guidance: "Hướng dẫn",
  draft: "Dự thảo",
};

export interface IssueInput {
  readonly state: KnownState;
  readonly today: string;
  readonly analysis: Analysis;
  readonly licensingSummary: string;
  readonly citations: readonly Citation[];
  readonly preset: string;
}

function title({ today, analysis }: IssueInput): string {
  const prefix = `Rà soát pháp lý ${today}`;
  if (analysis.newChanges.length > 0) return `${prefix}: ${analysis.newChanges.length} thay đổi cần xác minh`;
  if (analysis.licensingChanged) return `${prefix}: tình trạng cấp phép sàn thay đổi`;
  return `${prefix}: đến hạn rà soát sau ${analysis.reviewDueInDays} ngày`;
}

function changeBlock(c: Change): string {
  return [
    `### ${TYPE_LABEL[c.type]}: ${c.number ?? "(chưa có số hiệu)"} — ${c.title}`,
    `- Cơ quan: ${c.issuer ?? "?"} · Ban hành: ${c.issuedAt ?? "?"} · Hiệu lực: ${c.effectiveAt ?? "?"}`,
    `- Tóm tắt: ${c.summary}`,
    `- Ảnh hưởng: ${c.impact}`,
    `- Nguồn: ${c.sourceUrls.join(" · ")}`,
  ].join("\n");
}

/** GitHub issue for a human reviewer. AI output is a lead, never a source: every item must be verified. */
export function buildIssue(input: IssueInput): { title: string; body: string } {
  const { state, analysis, citations, licensingSummary, preset } = input;
  const sections = [
    "> ⚠ Kết quả do AI (Perplexity Agent API) tổng hợp. AI không phải nguồn pháp lý: chỉ cập nhật trang sau khi đối chiếu văn bản gốc.",
    `Kỳ rà soát: ${state.reviewedAt} → ${input.today} · preset \`${preset}\` · hạn rà soát tiếp theo: ${state.nextReviewDue}`,
    analysis.newChanges.length > 0 ? `## Thay đổi phát hiện\n\n${analysis.newChanges.map(changeBlock).join("\n\n")}` : "## Thay đổi phát hiện\n\nKhông có.",
    `## Cấp phép sàn\n\n${analysis.licensingChanged ? "**Có thay đổi so với `content/phap-ly/_cap-phep.json`.** " : ""}${licensingSummary || "Không có thông tin mới."}`,
    citations.length > 0 ? `## Nguồn tìm thấy\n\n${citations.map((c) => `- [${c.title}](${c.url})${c.date ? ` (${c.date})` : ""}`).join("\n")}` : "",
    [
      "## Việc cần làm",
      "- [ ] Đối chiếu văn bản gốc (cổng chính phủ, Thư viện Pháp luật) cho từng mục",
      "- [ ] Cập nhật `docs/LEGAL_REGISTER.md` (bảng, nguồn, change log, `reviewedAt`, `nextReviewDue`)",
      "- [ ] Thêm/sửa file trong `content/phap-ly/` và `content/phap-ly/_cap-phep.json` nếu cần",
      "- [ ] Kiểm tra lại quy tắc R1–R11 và chính sách (`content/policies/*`) có cần đổi không",
      "- [ ] Đóng issue này khi đã xong",
    ].join("\n"),
  ];
  return { title: title(input), body: sections.filter(Boolean).join("\n\n") };
}
