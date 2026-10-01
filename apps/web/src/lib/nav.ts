export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  readonly ready: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Thị trường", icon: "◧", ready: false },
  { href: "/rui-ro", label: "Trung tâm rủi ro", icon: "⛨", ready: false },
  { href: "/vi", label: "Theo dõi ví", icon: "◎", ready: false },
  { href: "/thue", label: "Công cụ thuế 0,1%", icon: "%", ready: true },
  { href: "/phap-ly", label: "Pháp lý crypto VN", icon: "§", ready: false },
  { href: "/kien-thuc", label: "Kiến thức", icon: "?", ready: false },
];

export const FOOTER_LINKS: readonly { href: string; label: string }[] = [
  { href: "/mien-tru-trach-nhiem", label: "Miễn trừ trách nhiệm" },
  { href: "/dieu-khoan", label: "Điều khoản" },
  { href: "/quyen-rieng-tu", label: "Quyền riêng tư" },
  { href: "/thay-doi-chinh-sach", label: "Lịch sử chính sách" },
];

export const SOURCE_REPO_URL = "https://github.com/bonguynvan/averosi";
