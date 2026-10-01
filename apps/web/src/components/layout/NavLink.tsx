"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type NavItem, navMatch } from "@/lib/nav";

/** "full"/"icon" share geometry (icons never move during the sidebar tween); "icon" hides labels visually only. */
export type NavLinkVariant = "full" | "icon" | "compact";

export function NavLink({ item, variant = "full" }: { item: NavItem; variant?: NavLinkVariant }) {
  const pathname = usePathname();
  const match = navMatch(item.href, pathname);
  const isActive = match !== null;
  const isIcon = variant === "icon";
  const base = "flex items-center gap-3 px-3 py-2 font-mono text-[13px] transition-colors duration-[var(--ds-duration-fast)]";
  const state = isActive ? "bg-accent text-text-on-accent font-semibold" : "text-text-muted hover:bg-surface hover:text-accent";

  return (
    <Link
      href={item.href}
      aria-current={match === "page" ? "page" : undefined}
      title={isIcon ? item.label : undefined}
      className={`${base} ${state} ${variant === "compact" ? "shrink-0" : ""}`}
    >
      <span aria-hidden="true" className="w-4 shrink-0 text-center">
        {item.icon}
      </span>
      <span data-nav-label className={isIcon ? "sr-only" : "whitespace-nowrap"}>
        {item.label}
      </span>
      {!item.ready && variant === "full" && (
        <span data-nav-label className="ml-auto text-[10px] whitespace-nowrap">
          SẮP CÓ
        </span>
      )}
    </Link>
  );
}
