/**
 * Smooth layout changes (sidebar, collapsible panels) without animating layout properties:
 * the View Transitions API snapshots before/after and the compositor morphs between them.
 * Browsers without the API, and users who prefer reduced motion, get an instant update.
 */
type DocumentWithViewTransition = Document & { startViewTransition?: (update: () => void) => unknown };

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function runViewTransition(update: () => void): void {
  const doc = (typeof document === "undefined" ? undefined : document) as DocumentWithViewTransition | undefined;
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(update);
}

/** `view-transition-name` must be a unique CSS ident; React ids contain «», : characters. */
export function viewTransitionName(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
