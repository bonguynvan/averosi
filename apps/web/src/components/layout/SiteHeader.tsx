import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-outline-subtle bg-surface-lowest px-4">
      <Link href="/" aria-label={`${BRAND.name} — trang chủ`} className="shrink-0">
        <Logo />
      </Link>
      <span className="label-caps border border-outline bg-surface px-2 py-0.5 text-accent">Chỉ đọc · Read-only</span>
    </header>
  );
}
