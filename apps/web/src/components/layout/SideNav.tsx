"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MOTION, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";
import { NAV_ITEMS } from "@/lib/nav";
import { sidebarCookie } from "@/lib/sidebar";
import { NavLink } from "./NavLink";

const NAV_ID = "primary-nav";
const WIDTH = { expanded: 256, collapsed: 56 } as const;

/**
 * Desktop sidebar: sticky below the header, own scroll, collapses to an icon rail.
 * GSAP tweens the column width (labels fade out first / in last), so the workspace glides
 * instead of jumping. Icons keep the same x position in both states. Preference persists in a
 * functional cookie read by the layout.
 */
export function SideNav({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const column = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: column });

  const labels = () => gsap.utils.toArray<HTMLElement>("[data-nav-label]", column.current);

  const toggle = contextSafe(() => {
    const next = !collapsed;
    document.cookie = sidebarCookie(next);
    const el = column.current;
    if (!el || prefersReducedMotion()) {
      setCollapsed(next);
      return;
    }

    if (next) {
      gsap
        .timeline({ defaults: { overwrite: "auto" } })
        .to(labels(), { opacity: 0, x: -6, duration: MOTION.fast, stagger: 0.012, ease: "power2.in" })
        .to(el, { width: WIDTH.collapsed, duration: MOTION.slow, ease: MOTION.easeInOut }, "<0.04")
        .add(() => {
          flushSync(() => setCollapsed(true));
          gsap.set(el, { clearProps: "width" });
        });
    } else {
      flushSync(() => setCollapsed(false));
      gsap.set(el, { width: WIDTH.collapsed });
      gsap.set(labels(), { opacity: 0, x: -6 });
      gsap
        .timeline({ defaults: { overwrite: "auto" } })
        .to(el, { width: WIDTH.expanded, duration: MOTION.slow, ease: MOTION.easeInOut })
        .to(labels(), { opacity: 1, x: 0, duration: MOTION.normal, stagger: 0.02, ease: MOTION.ease }, "-=0.1")
        .add(() => gsap.set([el, ...labels()], { clearProps: "width,opacity,transform" }));
    }
  });

  return (
    // Outer column spans the full content height and clips (overflow-x: clip, not hidden, so the inner nav can stay sticky).
    <div
      ref={column}
      className={`hidden shrink-0 overflow-x-clip border-r border-outline-subtle bg-surface-lowest will-change-[width] md:block ${collapsed ? "w-14" : "w-64"}`}
    >
      <nav
        id={NAV_ID}
        aria-label="Điều hướng chính"
        data-collapsed={collapsed}
        data-lenis-prevent
        className="sticky top-[var(--ds-shell-top)] flex max-h-[calc(100dvh-var(--ds-shell-top))] w-64 flex-col overflow-y-auto overscroll-contain"
      >
        <div className="flex h-10 items-center gap-2 pt-3 pb-2 pl-4">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={NAV_ID}
            aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            className="flex h-6 w-6 shrink-0 items-center justify-center border border-outline-subtle font-mono text-[12px] text-text-muted transition-colors duration-[var(--ds-duration-fast)] hover:border-accent hover:text-accent active:scale-95"
          >
            <span aria-hidden="true" className={`inline-block transition-transform duration-[var(--ds-duration-slow)] ${collapsed ? "rotate-180" : ""}`}>
              «
            </span>
          </button>
          {!collapsed && (
            <span data-nav-label className="label-caps text-accent">
              Bàn làm việc
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-0.5 px-2">
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
