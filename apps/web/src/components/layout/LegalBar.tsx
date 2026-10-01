import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * Persistent disclaimer strip — sticky in the root layout; never remove or make dismissible (CLAUDE.md §2).
 * Mobile shows a short version so the sticky header stays small. It may wrap but is never truncated.
 */
export function LegalBar() {
  return (
    <aside
      data-testid="legal-bar"
      aria-label="Cảnh báo pháp lý"
      className="flex items-center gap-2 border-b border-outline-subtle bg-surface-lowest px-4 py-1 font-mono text-[11px] leading-4 text-text-muted"
    >
      <span className="shrink-0 font-bold text-danger">⚠ PHÁP LÝ:</span>
      <p className="min-w-0 flex-1">
        <span className="md:hidden">Không phải sàn, không tư vấn đầu tư.</span>
        <span className="hidden md:inline">
          {BRAND.name} là công cụ mã nguồn mở, miễn phí, chỉ hiển thị dữ liệu công khai. Không phải sàn giao dịch, không lưu ký,
          không được cấp phép và không phải lời khuyên đầu tư.
        </span>
      </p>
      <Link href="/mien-tru-trach-nhiem" className="shrink-0 text-accent underline-offset-2 hover:underline">
        Chi tiết
      </Link>
    </aside>
  );
}
