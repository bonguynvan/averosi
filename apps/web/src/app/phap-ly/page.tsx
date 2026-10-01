import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Pháp lý tài sản mã hóa Việt Nam" };

export default function LegalTrackerPage() {
  return (
    <ComingSoon
      title="Pháp lý crypto Việt Nam"
      description="Theo dõi các văn bản pháp luật về tài sản mã hóa tại Việt Nam: Nghị quyết 05/2025/NQ-CP, Nghị định 284/2026/NĐ-CP, thuế 0,1%, bảo vệ dữ liệu cá nhân. Mỗi mục có ngày hiệu lực và đường dẫn nguồn chính thức."
      rules={[
        "Tóm tắt mang tính thông tin, không phải tư vấn pháp lý.",
        "Luôn dẫn nguồn văn bản gốc; rà soát ít nhất 30 ngày một lần.",
      ]}
    />
  );
}
