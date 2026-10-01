import type { Metadata } from "next";
import { TaxCalculator } from "@/components/tax/TaxCalculator";
import { Panel } from "@/components/ui/Panel";

export const metadata: Metadata = {
  title: "Công cụ ước tính thuế chuyển nhượng tài sản mã hóa 0,1%",
  description: "Ước tính thuế thu nhập cá nhân 0,1% trên mỗi lần chuyển nhượng tài sản mã hóa tại Việt Nam. Tính ngay trên trình duyệt, không lưu dữ liệu.",
};

export default function TaxPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Công cụ thuế 0,1%</h1>
      <Panel title="Ước tính thuế chuyển nhượng" aside={<span className="label-caps text-text-muted">Chạy trên trình duyệt</span>}>
        <TaxCalculator />
      </Panel>
      <Panel title="Căn cứ & lưu ý">
        <ul className="list-inside list-disc space-y-2 text-[13px] leading-5 text-text-muted">
          <li>
            Thông tư 32 của Bộ Tài chính (hiệu lực 27/03/2026): cá nhân chịu thuế thu nhập cá nhân 0,1% trên giá trị mỗi lần chuyển nhượng tài
            sản mã hóa; tổ chức cung cấp dịch vụ được cấp phép khấu trừ và nộp thay.
          </li>
          <li>Kết quả chỉ để tham khảo, làm tròn đến đồng. Số thuế thực tế do tổ chức khấu trừ và cơ quan thuế xác định.</li>
          <li>Không phải tư vấn thuế. Giá trị bạn nhập không được gửi đi hay lưu lại.</li>
        </ul>
      </Panel>
    </div>
  );
}
