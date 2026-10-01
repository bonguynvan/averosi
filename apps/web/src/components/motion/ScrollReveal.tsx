"use client";

import { type ReactNode, useRef } from "react";
import { MOTION, ScrollTrigger, gsap, useGSAP } from "@/lib/motion/gsap";

/**
 * Reveals `[data-reveal]` blocks as they scroll into view (opacity + y only).
 * Only elements that start below the fold are hidden, so nothing visible on first paint ever flashes.
 * Content stays fully visible without JS or with reduced motion.
 */
export function ScrollReveal({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const fold = window.innerHeight;
        const targets = gsap.utils
          .toArray<HTMLElement>("[data-reveal]", scope.current)
          .filter((el) => el.getBoundingClientRect().top > fold * 0.9);
        if (targets.length === 0) return;

        gsap.set(targets, { opacity: 0, y: 24 });
        ScrollTrigger.batch(targets, {
          start: "top 88%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: MOTION.slow * 1.6, ease: MOTION.ease, stagger: 0.08, clearProps: "transform,opacity" }),
        });
      });
      return () => mm.revert();
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
