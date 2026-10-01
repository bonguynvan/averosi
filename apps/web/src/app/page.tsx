import { ComingSoon } from "@/components/ui/ComingSoon";

export default function MarketsPage() {
  return (
    <ComingSoon
      title="Thị trường"
      description="Giá tham khảo của các tài sản lớn theo USD, quy đổi sang VNĐ bằng tỷ giá trung tâm của Ngân hàng Nhà nước. Mỗi con số luôn kèm nguồn và thời điểm cập nhật."
      rules={[
        "Giá tham khảo, không phải báo giá giao dịch.",
        "Không có nút mua/bán, không liên kết tới sàn, không tỷ giá OTC.",
        "Dữ liệu cũ được đánh dấu rõ, không bao giờ hiển thị số liệu giả.",
      ]}
    />
  );
}
