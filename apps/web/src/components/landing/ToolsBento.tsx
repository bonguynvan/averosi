import Link from "next/link";

interface Tool {
  readonly href: string;
  readonly title: string;
  readonly body: string;
  readonly detail: string;
  readonly ready: boolean;
  readonly span: string;
  /** What the tool checks — shown as a checklist on the featured tile (describes the method, not a result). */
  readonly checks?: readonly string[];
}

const TOOLS: readonly Tool[] = [
  {
    href: "/rui-ro",
    title: "Trung tâm rủi ro",
    body: "Dán địa chỉ ví hoặc hợp đồng trước khi chuyển tiền. Kết quả kèm nguồn và phương pháp, không bao giờ kết luận “an toàn”.",
    detail: "Ethereum · Base · BNB Chain",
    ready: true,
    span: "md:col-span-2 md:row-span-2",
    checks: [
      "Danh sách trừng phạt OFAC (SDN)",
      "Báo cáo lừa đảo công khai (ScamSniffer)",
      "Hợp đồng proxy có thể nâng cấp",
      "Ví ủy quyền mã EIP-7702",
      "Loại địa chỉ, số giao dịch, số dư",
    ],
  },
  {
    href: "/thue",
    title: "Thuế 0,1%",
    body: "Ước tính thuế thu nhập cá nhân trên mỗi lần chuyển nhượng.",
    detail: "100.000.000 ₫ → 100.000 ₫",
    ready: true,
    span: "",
  },
  {
    href: "/phap-ly",
    title: "Pháp lý crypto VN",
    body: "Văn bản, ngày hiệu lực, mức phạt. Có dẫn nguồn chính thức.",
    detail: "NQ 05/2025 · NĐ 284/2026 · TT 32/2026",
    ready: true,
    span: "",
  },
  {
    href: "/vi",
    title: "Theo dõi ví công khai",
    body: "Theo dõi số dư và giao dịch của địa chỉ công khai, lưu trên trình duyệt của bạn.",
    detail: "Sắp có",
    ready: false,
    span: "md:col-span-2",
  },
];

/** Bento grid of tools — asymmetric on purpose: the risk center is the primary action. */
export function ToolsBento() {
  return (
    <section aria-labelledby="tools-title" data-reveal className="flex flex-col gap-4">
      <h2 id="tools-title" className="font-mono text-[22px] leading-7 font-bold text-text">
        Công cụ miễn phí
      </h2>
      <ul className="grid gap-4 md:auto-rows-fr md:grid-cols-4">
        {TOOLS.map((t) => (
          <li key={t.href} className={t.span}>
            <Link
              href={t.href}
              className={`group flex h-full flex-col justify-between gap-6 border bg-surface-low p-5 transition-colors duration-[var(--ds-duration-fast)] ${
                t.ready ? "border-outline-subtle hover:border-accent" : "border-dashed border-outline-subtle opacity-70"
              }`}
            >
              <span className="flex flex-col gap-2">
                <span className="flex items-center justify-between">
                  <span className="font-mono text-[16px] font-semibold text-text group-hover:text-accent">{t.title}</span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-text-muted transition-transform duration-[var(--ds-duration-normal)] group-hover:translate-x-1 group-hover:text-accent"
                  >
                    →
                  </span>
                </span>
                <span className="text-[14px] leading-6 text-text-muted">{t.body}</span>
              </span>
              {t.checks && (
                <ul className="flex flex-col divide-y divide-outline-subtle border border-outline-subtle bg-canvas font-mono text-[12px]">
                  {t.checks.map((c) => (
                    <li key={c} className="flex items-center gap-3 px-3 py-2 text-text">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-led bg-accent" />
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              <span className={`font-mono text-[12px] ${t.ready ? "text-accent-soft" : "text-text-muted"}`}>{t.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
