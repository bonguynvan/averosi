"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function NavLink({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const base = "flex items-center gap-3 font-mono text-[13px] transition-colors duration-[var(--av-duration-fast)]";
  const state = isActive ? "bg-accent text-text-on-accent font-semibold" : "text-text-muted hover:bg-surface hover:text-accent";
  const size = compact ? "shrink-0 px-3 py-2" : "px-3 py-2";

  return (
    <Link href={item.href} aria-current={isActive ? "page" : undefined} className={`${base} ${state} ${size}`}>
      <span aria-hidden="true" className="w-4 text-center">
        {item.icon}
      </span>
      <span>{item.label}</span>
      {!item.ready && !compact && <span className="ml-auto text-[10px]">SẮP CÓ</span>}
    </Link>
  );
}
