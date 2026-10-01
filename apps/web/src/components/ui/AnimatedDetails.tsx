"use client";

import { type MouseEvent, type ReactNode, useRef } from "react";
import { MOTION, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";

interface AnimatedDetailsProps {
  readonly summary: ReactNode;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly className?: string;
  readonly summaryClassName?: string;
}

/**
 * Native <details> (works without JS, keeps semantics) with a GSAP height tween on toggle.
 * The open attribute is set before expanding and removed after collapsing.
 */
export function AnimatedDetails({ summary, children, defaultOpen = false, className, summaryClassName }: AnimatedDetailsProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: details });

  const onToggle = contextSafe((e: MouseEvent) => {
    const d = details.current;
    const c = content.current;
    if (!d || !c || prefersReducedMotion()) return; // native toggle
    e.preventDefault();
    if (d.open) {
      gsap.to(c, {
        height: 0,
        opacity: 0,
        duration: MOTION.slow,
        ease: MOTION.easeInOut,
        overwrite: "auto",
        onComplete: () => {
          d.open = false;
          gsap.set(c, { clearProps: "height,opacity" });
        },
      });
    } else {
      d.open = true;
      gsap.fromTo(c, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: MOTION.slow, ease: MOTION.easeInOut, overwrite: "auto", clearProps: "height,opacity" });
    }
  });

  return (
    <details ref={details} open={defaultOpen} className={className}>
      <summary onClick={onToggle} className={summaryClassName}>
        {summary}
      </summary>
      <div ref={content} className="overflow-hidden">
        {children}
      </div>
    </details>
  );
}
