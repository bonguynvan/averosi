import type { KnownState } from "./state";

/** Official sources and major Vietnamese legal/financial press. Perplexity allows at most 20 domains. */
export const TRUSTED_DOMAINS = [
  "chinhphu.vn",
  "vanban.chinhphu.vn",
  "xaydungchinhsach.chinhphu.vn",
  "baochinhphu.vn",
  "mof.gov.vn",
  "sbv.gov.vn",
  "quochoi.vn",
  "thuvienphapluat.vn",
  "luatvietnam.vn",
  "vietnamnet.vn",
  "vneconomy.vn",
  "vnexpress.net",
  "tuoitre.vn",
  "thanhnien.vn",
  "vietstock.vn",
  "cafef.vn",
  "nhandan.vn",
  "vtv.vn",
] as const;

const CHANGE = {
  type: "object",
  additionalProperties: false,
  required: ["type", "number", "title", "issuer", "issuedAt", "effectiveAt", "summary", "impact", "sourceUrls"],
  properties: {
    type: { type: "string", enum: ["new", "amended", "repealed", "guidance", "draft"] },
    number: { type: ["string", "null"], description: "Official number, e.g. 284/2026/NĐ-CP; null if not yet numbered" },
    title: { type: "string" },
    issuer: { type: ["string", "null"] },
    issuedAt: { type: ["string", "null"], description: "YYYY-MM-DD" },
    effectiveAt: { type: ["string", "null"], description: "YYYY-MM-DD" },
    summary: { type: "string", description: "Vietnamese, 1–3 sentences, facts only" },
    impact: { type: "string", description: "Vietnamese: what it means for individuals/investors" },
    sourceUrls: { type: "array", items: { type: "string" }, minItems: 1 },
  },
} as const;

export const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changes", "licensing"],
  properties: {
    changes: { type: "array", items: CHANGE },
    licensing: {
      type: "object",
      additionalProperties: false,
      required: ["anyLicensed", "summary", "sourceUrls"],
      properties: {
        anyLicensed: { type: "boolean", description: "true only if the Ministry of Finance has officially granted at least one crypto-asset exchange licence" },
        summary: { type: "string" },
        sourceUrls: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

const INSTRUCTIONS = [
  "You monitor Vietnamese law on crypto/digital assets for a compliance team.",
  "Report only instruments or official decisions published or taking effect within the given date window.",
  "Every item must cite at least one source URL you actually found. Never guess numbers or dates; use null when unknown.",
  "Write summary and impact in Vietnamese. Return JSON matching the schema, nothing else.",
].join(" ");

export interface AgentRequest {
  readonly preset: string;
  readonly instructions: string;
  readonly input: string;
  readonly tools: readonly {
    readonly type: "web_search";
    readonly filters: {
      readonly search_date_filter: { readonly start_date: string; readonly end_date: string };
      readonly search_domain_filter: readonly string[];
    };
  }[];
  readonly response_format: { readonly type: "json_schema"; readonly json_schema: { readonly name: string; readonly schema: typeof FINDINGS_SCHEMA } };
  readonly temperature: number;
  readonly max_output_tokens: number;
}

/** Request body for POST https://api.perplexity.ai/v1/agent (Agent API, successor of Sonar). */
export function buildAgentRequest(state: KnownState, today: string, preset: string): AgentRequest {
  const known = state.instruments.map((i) => `- ${i.number}: ${i.title} (hiệu lực ${i.effectiveAt})`).join("\n");
  const input = [
    `Khoảng thời gian cần rà soát: từ ${state.reviewedAt} đến ${today}.`,
    "Chủ đề: tài sản mã hóa / tài sản số tại Việt Nam — khung pháp lý, cấp phép sàn giao dịch (Bộ Tài chính), xử phạt, thuế, phòng chống rửa tiền, bảo vệ dữ liệu cá nhân liên quan, hướng dẫn của Ngân hàng Nhà nước.",
    "Văn bản đã theo dõi (chỉ báo cáo nếu được sửa đổi, bãi bỏ hoặc có hướng dẫn mới):",
    known,
    `Tình trạng cấp phép sàn đang ghi nhận (${state.licensing.asOf}): ${state.licensing.headline}.`,
    "Liệt kê văn bản mới, sửa đổi, bãi bỏ, hướng dẫn chính thức hoặc dự thảo quan trọng; và cập nhật tình trạng cấp phép sàn.",
  ].join("\n");

  return {
    preset,
    instructions: INSTRUCTIONS,
    input,
    tools: [
      {
        type: "web_search",
        filters: {
          search_date_filter: { start_date: state.reviewedAt, end_date: today },
          search_domain_filter: [...TRUSTED_DOMAINS],
        },
      },
    ],
    response_format: { type: "json_schema", json_schema: { name: "legal_findings", schema: FINDINGS_SCHEMA } },
    temperature: 0.1,
    max_output_tokens: 4000,
  };
}
