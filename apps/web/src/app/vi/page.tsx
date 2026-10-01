import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Theo dõi ví công khai" };

export default function WalletWatchPage() {
  return (
    <ComingSoon
      title="Theo dõi ví công khai"
      description="Theo dõi số dư và giao dịch gần đây của các địa chỉ công khai. Danh sách theo dõi chỉ lưu trên trình duyệt của bạn."
      rules={[
        "Không tài khoản, không gửi danh sách theo dõi về máy chủ.",
        "Chỉ gắn nhãn cho địa chỉ của tổ chức công khai, có trích nguồn.",
      ]}
    />
  );
}
