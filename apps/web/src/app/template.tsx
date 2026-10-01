import type { ReactNode } from "react";
import { ScrollReveal } from "@/components/motion/ScrollReveal";

/**
 * Re-mounts on every navigation. First paint eases in with a CSS keyframe (no hydration flash);
 * blocks marked `data-reveal` further down animate in with GSAP ScrollTrigger as they scroll into view.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="animate-enter">
      <ScrollReveal>{children}</ScrollReveal>
    </div>
  );
}
