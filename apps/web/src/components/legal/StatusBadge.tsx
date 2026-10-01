import type { LegalStatus } from "@app/core";

const STYLE: Record<LegalStatus, { label: string; cls: string }> = {
  "in-force": { label: "Đang hiệu lực", cls: "border-success text-success" },
  upcoming: { label: "Sắp hiệu lực", cls: "border-warning text-warning" },
  expired: { label: "Hết hiệu lực", cls: "border-outline text-text-muted" },
};

export function StatusBadge({ status }: { status: LegalStatus }) {
  const s = STYLE[status];
  return <span className={`label-caps inline-block border px-1.5 py-0.5 text-[10px] ${s.cls}`}>{s.label}</span>;
}
