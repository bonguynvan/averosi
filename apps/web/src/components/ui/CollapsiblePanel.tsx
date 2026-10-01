"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MOTION, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion/gsap";

interface CollapsiblePanelProps {
  readonly title: string;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

/**
 * Same look as Panel; the header toggles the body with a GSAP height tween (to/from `auto`)
 * plus a content fade. Collapsed bodies are `hidden` (out of the a11y tree). Never use for legal notices.
 */
export function CollapsiblePanel({ title, defaultOpen = true, children }: CollapsiblePanelProps) {
  const id = useId();
  const bodyId = `${id}-body`;
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: root });

  const toggle = contextSafe(() => {
    const el = body.current;
    if (!el || prefersReducedMotion()) {
      setOpen((v) => !v);
      return;
    }
    if (open) {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: MOTION.slow,
        ease: MOTION.easeInOut,
        overflow: "hidden",
        overwrite: "auto",
        onComplete: () => {
          flushSync(() => setOpen(false));
          gsap.set(el, { clearProps: "height,opacity,overflow" });
        },
      });
    } else {
      flushSync(() => setOpen(true));
      gsap.fromTo(
        el,
        { height: 0, opacity: 0, overflow: "hidden" },
        { height: "auto", opacity: 1, duration: MOTION.slow, ease: MOTION.easeInOut, overwrite: "auto", clearProps: "height,opacity,overflow" },
      );
    }
  });

  return (
    <section ref={root} className="border border-outline-subtle bg-surface-low">
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={`group flex w-full items-center justify-between gap-2 bg-surface px-3 py-2 text-left transition-colors duration-[var(--ds-duration-fast)] hover:bg-surface-high ${
            open ? "border-b border-outline-subtle" : ""
          }`}
        >
          <span className="label-caps text-accent">{title}</span>
          <span
            aria-hidden="true"
            className={`font-mono text-[12px] text-text-muted transition-transform duration-[var(--ds-duration-slow)] group-hover:text-accent ${open ? "" : "-rotate-90"}`}
          >
            ▾
          </span>
        </button>
      </h2>
      <div ref={body} id={bodyId} hidden={!open}>
        <div className="p-3">{children}</div>
      </div>
    </section>
  );
}
