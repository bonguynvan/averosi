"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ScrollTrigger, gsap, prefersReducedMotion } from "@/lib/motion/gsap";

/**
 * Lenis smooth scrolling driven by GSAP's ticker, so ScrollTrigger and Lenis share one frame loop.
 * Disabled for prefers-reduced-motion. Elements with `data-lenis-prevent` (sidebar, inner scrollers)
 * keep native scrolling.
 */
export function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const shellTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ds-shell-top")) || 0;
    const lenis = new Lenis({
      lerp: 0.12,
      wheelMultiplier: 1,
      anchors: { offset: -shellTop() - 8 },
      prevent: (node) => node.closest("[data-lenis-prevent]") !== null,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Next.js resets scroll on navigation; keep Lenis' internal position in sync instead of easing back.
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true, force: true });
    ScrollTrigger.refresh();
  }, [pathname]);

  return null;
}
