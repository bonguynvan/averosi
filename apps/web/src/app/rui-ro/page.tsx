import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Trung tâm rủi ro" };

export default function RiskCenterPage() {
  return (
    <ComingSoon
      title="Trung tâm rủi ro"
      description="Dán một địa chỉ ví hoặc hợp đồng để xem báo cáo rủi ro: có trong danh sách trừng phạt hay danh sách lừa đảo công khai không, các quyền token đã cấp, dấu hiệu hợp đồng bất thường. Phương pháp chấm điểm được công khai."
      rules={[
        "Chỉ đọc dữ liệu công khai trên blockchain; không kết nối ví, không ký giao dịch.",
        "Không gắn danh tính cá nhân với địa chỉ ví.",
        "“Không phát hiện rủi ro” không có nghĩa là an toàn.",
      ]}
    />
  );
}
