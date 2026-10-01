"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export type NavLinkVariant = "full" | "icon" | "compact";

const SIZE: Record<NavLinkVariant, string> = {
  full: "px-3 py-2",
  icon: "justify-center px-0 py-2",
  compact: "shrink-0 px-3 py-2",
};

export function NavLink({ item, variant = "full" }: { item: NavItem; variant?: NavLinkVariant }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const base = "flex items-center gap-3 font-mono text-[13px] transition-colors duration-[var(--ds-duration-fast)]";
  const state = isActive ? "bg-accent text-text-on-accent font-semibold" : "text-text-muted hover:bg-surface hover:text-accent";

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      title={variant === "icon" ? item.label : undefined}
      className={`${base} ${state} ${SIZE[variant]}`}
    >
      <span aria-hidden="true" className="w-4 text-center">
        {item.icon}
      </span>
      <span className={variant === "icon" ? "sr-only" : undefined}>{item.label}</span>
      {!item.ready && variant === "full" && <span className="ml-auto text-[10px]">SẮP CÓ</span>}
    </Link>
  );
}
