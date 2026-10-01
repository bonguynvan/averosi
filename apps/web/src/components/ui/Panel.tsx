import type { ReactNode } from "react";

export function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-outline-subtle bg-surface-low">
      <header className="flex items-center justify-between gap-2 border-b border-outline-subtle bg-surface px-3 py-2">
        <h2 className="label-caps text-accent">{title}</h2>
        {aside}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
