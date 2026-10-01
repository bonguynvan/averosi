import { BRAND } from "@/lib/brand";

const FAQ: readonly { readonly q: string; readonly a: string }[] = [
  {
    q: `${BRAND.name} có phải sàn giao dịch không?`,
    a: `Không. ${BRAND.name} chỉ hiển thị dữ liệu công khai. Trang không tổ chức giao dịch, không môi giới, không lưu ký, không nắm giữ khóa hay tài sản của ai, và không được cấp phép theo Nghị quyết 05/2025/NQ-CP.`,
  },
  {
    q: "Giá trên trang lấy từ đâu?",
    a: "Giá là trung vị giá khớp gần nhất của các cặp giao dịch bằng USD pháp định trên Coinbase, Kraken, Bitstamp và Gemini, quy đổi sang VNĐ theo tỷ giá USD chuyển khoản do Vietcombank công bố. Tên sàn chỉ để ghi nguồn dữ liệu. Đây là giá tham khảo, không phải báo giá giao dịch.",
  },
  {
    q: "Người Việt có được giao dịch tài sản mã hóa không?",
    a: "Theo Nghị quyết 05/2025/NQ-CP, nhà đầu tư trong nước chỉ được giao dịch qua tổ chức được Bộ Tài chính cấp phép. Từ 01/09/2026, giao dịch không qua tổ chức được cấp phép có thể bị phạt 30–50 triệu đồng (Nghị định 284/2026/NĐ-CP). Theo thông tin công bố đến ngày cập nhật, chưa có tổ chức nào được cấp phép chính thức.",
  },
  {
    q: "Chuyển nhượng tài sản mã hóa chịu thuế thế nào?",
    a: "Cá nhân chịu thuế thu nhập cá nhân 0,1% trên giá trị mỗi lần chuyển nhượng (Thông tư 32/2026/TT-BTC; Luật Thuế TNCN 109/2025/QH15 từ 01/07/2026). Tổ chức được cấp phép sẽ khấu trừ và nộp thay.",
  },
  {
    q: `${BRAND.name} có thu phí hay thu thập dữ liệu của tôi không?`,
    a: "Không. Trang miễn phí, không cần tài khoản, không dùng cookie theo dõi hay công cụ quảng cáo. Danh sách theo dõi (khi có) chỉ lưu trên trình duyệt của bạn.",
  },
];

/** Native <details>: accessible, works without JS; the chevron rotates via CSS only. */
export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-4">
      <h2 id="faq-title" className="font-mono text-[22px] leading-7 font-bold text-text">
        Câu hỏi thường gặp
      </h2>
      <div className="divide-y divide-outline-subtle border border-outline-subtle bg-surface-low">
        {FAQ.map((item, i) => (
          <details key={item.q} open={i === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-mono text-[14px] font-semibold text-text transition-colors duration-[var(--ds-duration-fast)] hover:text-accent [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="text-accent transition-transform duration-[var(--ds-duration-normal)] group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="animate-fade px-4 pb-4 text-[14px] leading-6 text-text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
