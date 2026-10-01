"use client";

import { useEffect } from "react";

/**
 * Publishes the sticky header block's height as --ds-shell-top so the sidebar, table headers and
 * anchor scrolling sit right below it. The height changes with viewport width (legal bar wraps).
 */
export function ShellMetrics({ targetId }: { targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--ds-shell-top", `${el.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, [targetId]);

  return null;
}
