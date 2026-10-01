import Link from "next/link";

/** Persistent disclaimer strip — rendered in the root layout; never remove or make dismissible (CLAUDE.md §2). */
export function LegalBar() {
  return (
    <aside
      data-testid="legal-bar"
      aria-label="Cảnh báo pháp lý"
      className="flex items-center gap-2 border-b border-outline-subtle bg-surface-lowest px-4 py-1 font-mono text-[11px] leading-4 text-text-muted"
    >
      <span className="shrink-0 font-bold text-danger">⚠ PHÁP LÝ:</span>
      <p className="min-w-0 flex-1">
        Averosi là công cụ mã nguồn mở, miễn phí, chỉ hiển thị dữ liệu công khai. Không phải sàn giao dịch, không lưu ký,
        không được cấp phép và không phải lời khuyên đầu tư.{" "}
        <Link href="/mien-tru-trach-nhiem" className="text-accent underline-offset-2 hover:underline">
          Chi tiết
        </Link>
      </p>
    </aside>
  );
}
