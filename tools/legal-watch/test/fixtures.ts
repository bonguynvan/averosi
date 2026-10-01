import type { KnownState } from "../src/state";

export const STATE: KnownState = {
  reviewedAt: "2026-10-01",
  nextReviewDue: "2026-10-31",
  instruments: [
    { slug: "nghi-dinh-284-2026-nd-cp", number: "284/2026/NĐ-CP", title: "Xử phạt vi phạm về tài sản mã hóa", effectiveAt: "2026-09-01" },
    { slug: "thong-tu-32-2026-tt-btc", number: "32/2026/TT-BTC", title: "Thuế giao dịch tài sản mã hóa", effectiveAt: "2026-03-27" },
  ],
  licensing: { asOf: "2026-10-01", anyLicensed: false, headline: "Chưa có tổ chức nào được cấp phép chính thức" },
};
