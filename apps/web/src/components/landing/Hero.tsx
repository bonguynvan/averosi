import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

const TRUST = ["Miễn phí", "Mã nguồn mở", "Không cần tài khoản", "Không lưu ký"] as const;

export function Hero({ board }: { board: ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border border-outline-subtle bg-canvas">
      {/* Vietnamese đồng sign as an oversized outline mark — the page's one decorative flourish. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -bottom-24 -z-10 font-mono text-[420px] leading-none font-bold text-transparent select-none [-webkit-text-stroke:1px_var(--ds-color-outline-subtle)]"
      >
        ₫
      </span>
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="flex flex-col gap-6">
          <p className="label-caps flex items-center gap-2 text-accent">
            <span className="border border-accent px-1.5 py-0.5">VN</span>
            Dữ liệu Web3 cho người Việt
          </p>
          <h1 id="hero-title" className="font-mono text-[32px] leading-[1.1] font-bold tracking-tight text-text sm:text-[42px] xl:text-[50px]">
            Giá crypto bằng <span className="text-accent">VNĐ</span>.
            <br />
            Minh bạch nguồn.
            <br />
            <span className="text-text-muted">
              Đúng luật <span className="whitespace-nowrap">Việt Nam.</span>
            </span>
          </h1>
          <p className="max-w-xl text-[16px] leading-7 text-text-muted">
            {BRAND.name} tổng hợp dữ liệu công khai, quy đổi theo tỷ giá Vietcombank, kiểm tra rủi ro ví và theo dõi pháp lý tài sản mã hóa. Chỉ
            đọc dữ liệu, không giao dịch, không nắm giữ tài sản của ai.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/thi-truong"
              className="label-caps bg-accent px-5 py-3 text-text-on-accent transition-opacity duration-[var(--ds-duration-fast)] hover:opacity-90 active:scale-[0.98]"
            >
              Xem thị trường →
            </Link>
            <Link
              href="/rui-ro"
              className="label-caps border border-accent px-5 py-3 text-accent transition-colors duration-[var(--ds-duration-fast)] hover:bg-accent-tint active:scale-[0.98]"
            >
              Kiểm tra ví
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-text-muted">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-success">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>{board}</div>
      </div>
    </section>
  );
}
