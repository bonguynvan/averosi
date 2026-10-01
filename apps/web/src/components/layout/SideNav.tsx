"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { NAV_ITEMS } from "@/lib/nav";
import { sidebarCookie } from "@/lib/sidebar";
import { runViewTransition } from "@/lib/viewTransition";
import { NavLink } from "./NavLink";

const NAV_ID = "primary-nav";

/**
 * Desktop sidebar: sticky below the header with its own scroll; collapses to an icon rail.
 * The resize is animated by a view transition (snapshots morph on the compositor), not by
 * animating `width`. Preference persists in a functional cookie read by the layout.
 */
export function SideNav({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    document.cookie = sidebarCookie(next);
    runViewTransition(() => flushSync(() => setCollapsed(next)));
  };

  return (
    // Outer column spans the full content height (border + background); the nav inside sticks.
    <div className={`hidden shrink-0 border-r border-outline-subtle bg-surface-lowest [view-transition-name:sidebar] md:block ${collapsed ? "w-14" : "w-64"}`}>
    <nav
      id={NAV_ID}
      aria-label="Điều hướng chính"
      data-collapsed={collapsed}
      className="sticky top-[var(--ds-shell-top)] flex max-h-[calc(100dvh-var(--ds-shell-top))] flex-col overflow-y-auto overscroll-contain"
    >
      <div className={`flex items-center pt-3 pb-2 ${collapsed ? "justify-center" : "justify-between px-4"}`}>
        {!collapsed && <span className="label-caps text-accent">Bàn làm việc</span>}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={NAV_ID}
          aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          className="border border-outline-subtle px-2 py-0.5 font-mono text-[12px] text-text-muted transition-colors duration-[var(--ds-duration-fast)] hover:border-accent hover:text-accent active:scale-95"
        >
          <span aria-hidden="true" className={`inline-block transition-transform duration-[var(--ds-duration-slow)] ${collapsed ? "rotate-180" : ""}`}>
            «
          </span>
        </button>
      </div>
      <ul className={`flex flex-col gap-0.5 ${collapsed ? "px-1" : "px-2"}`}>
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink item={item} variant={collapsed ? "icon" : "full"} />
          </li>
        ))}
      </ul>
    </nav>
    </div>
  );
}
