import type { Metadata } from "next";
import { RiskChecker } from "@/components/risk/RiskChecker";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import { Panel } from "@/components/ui/Panel";
import { RISK_LISTS } from "@/lib/risk/instance";

export const metadata: Metadata = {
  title: "Trung tâm rủi ro: kiểm tra ví và hợp đồng",
  description:
    "Kiểm tra miễn phí một địa chỉ EVM với danh sách trừng phạt OFAC và danh sách lừa đảo công khai, kèm đặc điểm hợp đồng. Chỉ đọc dữ liệu, không kết nối ví.",
};

const CHECKS = [
  { name: "Danh sách trừng phạt", detail: "Khớp với địa chỉ ETH/EVM trong danh sách SDN của OFAC (Bộ Tài chính Hoa Kỳ).", effect: "Có → Rủi ro cao" },
  { name: "Báo cáo lừa đảo", detail: "Khớp với danh sách địa chỉ phishing công khai của ScamSniffer (trễ 7 ngày).", effect: "Có → Rủi ro cao" },
  { name: "Proxy nâng cấp được", detail: "Đọc các slot proxy chuẩn (EIP-1967 implementation/beacon, ZeppelinOS).", effect: "Có → Cần thận trọng" },
  { name: "Ủy quyền EIP-7702", detail: "Ví thường đã ủy quyền mã cho một hợp đồng; hiển thị địa chỉ được ủy quyền.", effect: "Chỉ để tham khảo" },
  { name: "Loại địa chỉ, hoạt động", detail: "Có mã thực thi hay không, số giao dịch đã gửi, số dư gốc.", effect: "Chỉ để tham khảo" },
] as const;

export default function RiskCenterPage() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Trung tâm rủi ro</h1>
        <Panel title="Kiểm tra địa chỉ" aside={<span className="label-caps text-text-muted">Ethereum · Base · BNB Chain</span>}>
          <RiskChecker />
        </Panel>
      </div>

      <aside className="flex flex-col gap-4" aria-label="Phương pháp">
        <CollapsiblePanel title="Phương pháp">
          <ul className="flex flex-col gap-3 text-[13px] leading-5">
            {CHECKS.map((c) => (
              <li key={c.name}>
                <p className="font-mono font-semibold text-text">{c.name}</p>
                <p className="text-text-muted">{c.detail}</p>
                <p className="font-mono text-[11px] text-accent-soft">{c.effect}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-outline-subtle pt-3 text-[12px] leading-5 text-text-muted">
            Nếu một nguồn danh sách không phản hồi, kết quả là “Chưa đủ dữ liệu”, không bao giờ mặc định là không có rủi ro.
          </p>
        </CollapsiblePanel>

        <Panel title="Giới hạn">
          <ul className="list-inside list-disc space-y-1 text-[12px] leading-5 text-text-muted">
            <li>Chỉ phát hiện rủi ro đã được công bố. Địa chỉ lừa đảo mới có thể chưa có trong danh sách.</li>
            <li>Chưa kiểm tra quyền token (approvals) và mã nguồn hợp đồng; sẽ bổ sung.</li>
            <li>Kết quả không phải tư vấn pháp lý hay đầu tư.</li>
          </ul>
        </Panel>

        <CollapsiblePanel title="Nguồn mở">
          <ul className="space-y-1 font-mono text-[12px]">
            {Object.values(RISK_LISTS).map((list) => (
              <li key={list.name}>
                <a href={list.homepage} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {list.name} ↗
                </a>
              </li>
            ))}
          </ul>
        </CollapsiblePanel>
      </aside>
    </div>
  );
}
