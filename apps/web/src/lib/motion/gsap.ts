"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** JS mirror of the motion tokens in design/tokens.css (seconds). */
export const MOTION = {
  fast: 0.12,
  normal: 0.2,
  slow: 0.32,
  ease: "power3.out",
  easeInOut: "power3.inOut",
  stagger: 0.03,
} as const;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export { gsap, ScrollTrigger, useGSAP };
