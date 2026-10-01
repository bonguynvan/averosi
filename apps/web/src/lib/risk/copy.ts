import type { FindingId, RiskLevel } from "@app/core";

/** All user-facing risk copy in one place so legal review is one file. Factual only — never "an toàn" (R4). */

export const LEVEL_COPY: Record<RiskLevel, { readonly label: string; readonly summary: string; readonly tone: "danger" | "warning" | "success" | "muted" }> = {
  high: { label: "Rủi ro cao", summary: "Địa chỉ khớp với ít nhất một danh sách rủi ro công khai.", tone: "danger" },
  medium: { label: "Cần thận trọng", summary: "Không có trong danh sách rủi ro, nhưng có đặc điểm cần tìm hiểu thêm.", tone: "warning" },
  low: {
    label: "Không phát hiện tín hiệu rủi ro",
    summary: "Không khớp danh sách nào trong các kiểm tra đã chạy. Điều này không có nghĩa là địa chỉ an toàn.",
    tone: "success",
  },
  unknown: { label: "Chưa đủ dữ liệu", summary: "Một hoặc nhiều nguồn danh sách không phản hồi nên chưa thể kết luận.", tone: "muted" },
};

export const FINDING_COPY: Record<FindingId, { readonly title: string; readonly detail: string }> = {
  sanctioned: {
    title: "Có trong danh sách trừng phạt OFAC (SDN)",
    detail:
      "Bộ Tài chính Hoa Kỳ đã đưa địa chỉ này vào danh sách trừng phạt. Giao dịch với địa chỉ bị trừng phạt có thể khiến tài sản bị phong tỏa tại các nền tảng tuân thủ quy định.",
  },
  "phishing-reported": {
    title: "Bị báo cáo liên quan đến lừa đảo (phishing)",
    detail: "Địa chỉ có trong danh sách công khai của ScamSniffer. Danh sách mở được công bố trễ 7 ngày.",
  },
  "upgradeable-proxy": {
    title: "Hợp đồng có thể nâng cấp (proxy)",
    detail:
      "Bên quản trị có thể thay đổi logic của hợp đồng bất cứ lúc nào. Bản thân điều này không phải dấu hiệu lừa đảo, nhưng bạn đang phải tin tưởng bên quản trị.",
  },
  "eip7702-delegated": {
    title: "Ví thường có ủy quyền mã (EIP-7702)",
    detail:
      "Chủ ví đã ủy quyền cho một hợp đồng thực thi thay ví. Ví thông minh hợp lệ cũng dùng cơ chế này, nhưng kẻ lừa đảo từng lừa người dùng ký ủy quyền cho hợp đồng rút tiền. Hãy kiểm tra hợp đồng được ủy quyền.",
  },
  "is-contract": {
    title: "Đây là hợp đồng thông minh",
    detail: "Địa chỉ chứa mã thực thi. Hãy xem mã nguồn đã được xác minh trên trình duyệt khối trước khi tương tác.",
  },
  "no-outgoing-activity": {
    title: "Địa chỉ chưa từng gửi giao dịch",
    detail: "Có thể là ví mới hoặc ví chỉ nhận. Hãy kiểm tra kỹ nếu ai đó yêu cầu bạn chuyển tiền tới địa chỉ này.",
  },
  "check-failed": {
    title: "Không kiểm tra được nguồn dữ liệu",
    detail: "Nguồn tạm thời không phản hồi; kết quả chưa đầy đủ. Hãy thử lại sau ít phút.",
  },
};

export const ERROR_COPY = {
  UNSUPPORTED_CHAIN: "Chọn một mạng được hỗ trợ.",
  INVALID_ADDRESS: "Địa chỉ không hợp lệ. Nhập địa chỉ EVM dạng 0x… gồm 40 ký tự hex.",
  RATE_LIMITED: "Bạn kiểm tra quá nhanh. Vui lòng đợi một phút rồi thử lại.",
  UNAVAILABLE: "Hệ thống kiểm tra tạm thời gián đoạn. Vui lòng thử lại sau.",
} as const;
