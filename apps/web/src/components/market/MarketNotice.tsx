import { MARKET_SOURCE_NOTES } from "@/lib/market/instance";
import { CollapsiblePanel } from "../ui/CollapsiblePanel";
import { Panel } from "../ui/Panel";

/** Methodology + legal notice for every market view (LEGAL_REGISTER R3, R4, R8). */
export function MarketNotice() {
  return (
    <>
      <CollapsiblePanel title="Cách tính">
        <ul className="space-y-2 text-[13px] leading-5 text-text-muted">
          <li>Giá = trung vị giá khớp gần nhất của các cặp USD pháp định trên các sàn bên dưới. Không dùng giá stablecoin (USDT).</li>
          <li>Quy đổi VNĐ theo tỷ giá USD chuyển khoản do Vietcombank công bố.</li>
          <li>24h = trung vị biến động 24 giờ của các nguồn có số liệu 24 giờ cuộn.</li>
          <li>*KL 24h chỉ cộng khối lượng trên các nguồn tổng hợp, không phải toàn thị trường.</li>
          <li>Cột Nguồn màu vàng = chỉ có 1 nguồn, độ tin cậy thấp.</li>
        </ul>
        <ul className="mt-3 space-y-0.5 border-t border-outline-subtle pt-3 font-mono text-[12px]">
          {MARKET_SOURCE_NOTES.map((s) => (
            <li key={s.name}>
              <span className="text-text">{s.name}</span> <span className="text-text-muted">· {s.note}</span>
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
      <Panel title="Lưu ý pháp lý">
        <ul className="list-inside list-disc space-y-1 text-[12px] leading-5 text-text-muted">
          <li>Giá tham khảo, không phải báo giá giao dịch, có thể chậm hoặc sai.</li>
          <li>Tên sàn chỉ để ghi nguồn dữ liệu. Không liên kết, không giới thiệu, không khuyến khích sử dụng.</li>
          <li>Theo quy định hiện hành, nhà đầu tư trong nước chỉ được giao dịch tài sản mã hóa qua tổ chức được Bộ Tài chính cấp phép.</li>
          <li>Không phải lời khuyên đầu tư.</li>
        </ul>
      </Panel>
    </>
  );
}
