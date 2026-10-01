import type { Metadata } from "next";
import Link from "next/link";
import { ApprovalChecker } from "@/components/approvals/ApprovalChecker";
import { Panel } from "@/components/ui/Panel";

export const metadata: Metadata = {
  title: "Quyền token: kiểm tra và thu hồi",
  description: "Quét toàn bộ quyền chi tiêu token (ERC-20, NFT, Permit2) mà ví đã cấp, xem quyền còn hiệu lực và tự thu hồi bằng ví của bạn.",
};

export default function ApprovalsPage() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Quyền token</h1>
        <Panel title="Kiểm tra quyền đã cấp">
          <ApprovalChecker />
        </Panel>
      </div>
      <aside className="flex flex-col gap-4" aria-label="Cách hoạt động và lưu ý">
        <Panel title="Cách hoạt động">
          <ul className="list-inside list-disc space-y-1 text-[12px] leading-5 text-text-muted">
            <li>Tìm mọi sự kiện cấp quyền của ví: ERC-20 Approval, NFT ApprovalForAll và Permit2.</li>
            <li>Đọc lại quyền hiện tại trên blockchain. Quyền đã về 0 hoặc đã hết hạn sẽ không hiển thị.</li>
            <li>Đánh dấu bên được cấp quyền nếu có trong danh sách trừng phạt OFAC hoặc danh sách lừa đảo công khai.</li>
            <li>“Quét một phần” nghĩa là ví có lịch sử quá dài cho một lần quét. Kết quả vẫn ưu tiên các quyền mới nhất.</li>
          </ul>
        </Panel>
        <Panel title="Thu hồi">
          <ul className="list-inside list-disc space-y-1 text-[12px] leading-5 text-text-muted">
            <li>Thu hồi là giao dịch do chính bạn ký trong ví, chỉ khi bạn bấm. Bạn trả phí gas cho mạng. Chúng tôi không thu phí.</li>
            <li>Trang hiển thị chính xác lệnh sẽ gọi trước khi ví mở. Luôn kiểm tra lại nội dung trong ví.</li>
            <li>
              Không bao giờ nhập cụm từ khôi phục vào bất kỳ trang nào. Đọc thêm:{" "}
              <Link href="/kien-thuc/quyen-token-approval" className="text-accent underline">
                quyền token là gì
              </Link>
              .
            </li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}
