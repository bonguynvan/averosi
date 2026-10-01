import { formatBps } from "@app/core";

/** Direction is always shown by symbol and sign, never by colour alone (docs/DESIGN.md). */
export function Change({ bps }: { bps: number | null }) {
  if (bps === null) return <span className="text-text-muted">—</span>;
  const tone = bps > 0 ? "text-up" : bps < 0 ? "text-down" : "text-flat";
  const mark = bps > 0 ? "▲" : bps < 0 ? "▼" : "■";
  return (
    <span className={tone}>
      <span aria-hidden="true">{mark} </span>
      {formatBps(bps)}
    </span>
  );
}
