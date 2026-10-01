import type { ReactNode } from "react";

/** Re-mounts on every navigation: content eases in (opacity + transform only, off for reduced motion). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-enter">{children}</div>;
}
