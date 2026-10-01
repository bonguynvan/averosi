"use client";

import { type ReactNode, useId, useState } from "react";
import { flushSync } from "react-dom";
import { runViewTransition, viewTransitionName } from "@/lib/viewTransition";

interface CollapsiblePanelProps {
  readonly title: string;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

/**
 * Same look as Panel, but the header toggles the body. The height change is a view transition
 * (clip-reveal on the compositor), so neighbours glide instead of jumping. Never use for legal notices.
 */
export function CollapsiblePanel({ title, defaultOpen = true, children }: CollapsiblePanelProps) {
  const id = useId();
  const bodyId = `${id}-body`;
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => runViewTransition(() => flushSync(() => setOpen((v) => !v)));

  return (
    <section className="border border-outline-subtle bg-surface-low" style={{ viewTransitionName: viewTransitionName("panel", id) }}>
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
      <div id={bodyId} hidden={!open} className="p-3">
        {children}
      </div>
    </section>
  );
}
