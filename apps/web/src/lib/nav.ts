export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  readonly ready: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Tổng quan", icon: "◆", ready: true },
  { href: "/thi-truong", label: "Thị trường", icon: "◧", ready: true },
  { href: "/bieu-do", label: "Biểu đồ", icon: "▥", ready: true },
  { href: "/rui-ro", label: "Trung tâm rủi ro", icon: "⛨", ready: true },
  { href: "/vi", label: "Theo dõi ví", icon: "◎", ready: true },
  { href: "/thue", label: "Công cụ thuế 0,1%", icon: "%", ready: true },
  { href: "/phap-ly", label: "Pháp lý crypto VN", icon: "§", ready: true },
  { href: "/kien-thuc", label: "Kiến thức", icon: "?", ready: false },
];

export const FOOTER_LINKS: readonly { href: string; label: string }[] = [
  { href: "/mien-tru-trach-nhiem", label: "Miễn trừ trách nhiệm" },
  { href: "/dieu-khoan", label: "Điều khoản" },
  { href: "/quyen-rieng-tu", label: "Quyền riêng tư" },
  { href: "/thay-doi-chinh-sach", label: "Lịch sử chính sách" },
];

/** Extra path prefixes that belong to a nav section (asset pages live under the market). */
const SECTION_ALIASES: Readonly<Record<string, readonly string[]>> = { "/thi-truong": ["/tai-san"] };

/** "page" = this exact page (aria-current), "section" = a child page of this item, null = unrelated. */
export function navMatch(href: string, pathname: string): "page" | "section" | null {
  if (pathname === href) return "page";
  if (href === "/") return null;
  const prefixes = [href, ...(SECTION_ALIASES[href] ?? [])];
  return prefixes.some((p) => pathname.startsWith(`${p}/`)) ? "section" : null;
}
