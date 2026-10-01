import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Kiến thức" };

export default function LearnPage() {
  return (
    <ComingSoon
      title="Kiến thức"
      description="Hướng dẫn tự bảo vệ tài sản số: an toàn ví tự quản, nhận diện lừa đảo phổ biến, cách thị trường thí điểm tài sản mã hóa tại Việt Nam vận hành."
      rules={["Nội dung giáo dục, không giới thiệu tài sản hay nền tảng giao dịch cụ thể."]}
    />
  );
}
