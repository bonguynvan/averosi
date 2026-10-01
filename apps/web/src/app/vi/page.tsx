import type { Metadata } from "next";
import { Suspense } from "react";
import { Panel } from "@/components/ui/Panel";
import { WalletPage } from "@/components/wallet/WalletPage";

export const metadata: Metadata = {
  title: "Theo dõi ví công khai",
  description: "Theo dõi số dư, stablecoin, giao dịch mới và cảnh báo rủi ro của địa chỉ ví công khai. Danh sách lưu trên trình duyệt của bạn.",
};

export default function WalletWatchPage() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Theo dõi ví công khai</h1>
        <Suspense>
          <WalletPage />
        </Suspense>
      </div>
      <aside className="flex flex-col gap-4" aria-label="Lưu ý">
        <Panel title="Cách hoạt động">
          <ul className="list-inside list-disc space-y-1 text-[12px] leading-5 text-text-muted">
            <li>Danh sách và ghi chú lưu trên trình duyệt này, không có tài khoản.</li>
            <li>Số dư đọc trực tiếp từ blockchain công khai, làm mới mỗi phút khi bạn đang mở trang.</li>
            <li>Giá trị VNĐ của coin gốc là giá tham khảo. Stablecoin chỉ hiển thị số lượng.</li>
            <li>“+N mới” đếm giao dịch ví đã gửi kể từ lần bạn xem trước.</li>
          </ul>
        </Panel>
        <Panel title="Lưu ý">
          <ul className="list-inside list-disc space-y-1 text-[12px] leading-5 text-text-muted">
            <li>Chỉ theo dõi, không gửi hay nhận tiền, không ký giao dịch.</li>
            <li>Không gắn danh tính cá nhân với địa chỉ. Ghi chú chỉ bạn thấy.</li>
            <li>Không phải lời khuyên đầu tư.</li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}
