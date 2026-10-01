"use client";

import { useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { sidebarCookie } from "@/lib/sidebar";
import { NavLink } from "./NavLink";

const NAV_ID = "primary-nav";

/** Desktop sidebar; collapses to an icon rail. Preference persists in a functional cookie read by the layout. */
export function SideNav({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookie(next);
  };

  return (
    <nav
      id={NAV_ID}
      aria-label="Điều hướng chính"
      data-collapsed={collapsed}
      className={`hidden shrink-0 flex-col border-r border-outline-subtle bg-surface-lowest md:flex ${collapsed ? "w-14" : "w-64"}`}
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
          className="border border-outline-subtle px-2 py-0.5 font-mono text-[12px] text-text-muted hover:border-accent hover:text-accent"
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
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
  );
}
