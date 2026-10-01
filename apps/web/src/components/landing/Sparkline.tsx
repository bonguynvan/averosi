import type { Sparkline as SparklineData } from "@app/core";

const TONE = { up: "stroke-up", down: "stroke-down", flat: "stroke-flat" } as const;

/** Decorative 24h line; the numeric change next to it carries the meaning (aria-hidden). */
export function Sparkline({ data, width = 96, height = 28 }: { data: SparklineData | null; width?: number; height?: number }) {
  if (!data) return <span aria-hidden="true" className="inline-block" style={{ width, height }} />;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" className="overflow-visible">
      <path d={data.d} fill="none" strokeWidth="1.5" strokeLinejoin="round" className={TONE[data.direction]} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
