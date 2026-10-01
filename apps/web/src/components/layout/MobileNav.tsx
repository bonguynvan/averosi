"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { prefersReducedMotion } from "@/lib/viewTransition";
import { NavLink } from "./NavLink";

/** Mobile: one snapping row that scrolls inside itself (never the page) and keeps the active item in view. */
export function MobileNav() {
  const scroller = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const active = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <nav aria-label="Điều hướng chính (di động)" className="border-b border-outline-subtle bg-surface-lowest md:hidden">
      <div ref={scroller} className="scroll-fade-x overflow-x-auto overscroll-x-contain">
        <ul className="flex w-max px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.href} className="snap-center">
              <NavLink item={item} variant="compact" />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
