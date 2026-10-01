import { MARKET_ASSETS, findAsset } from "@app/core";
import type { Metadata } from "next";
import { ChartTerminal } from "@/components/chart/ChartTerminal";

export const metadata: Metadata = {
  title: "Biểu đồ kỹ thuật",
  description:
    "Biểu đồ nến đầy đủ: chỉ báo kỹ thuật, công cụ vẽ, nhiều kiểu biểu đồ và khung thời gian. Dữ liệu tham khảo từ cặp USD pháp định, chỉ đọc.",
};

type Props = { searchParams: Promise<{ ma?: string }> };

/** Full-bleed chart terminal: fills the viewport below the sticky shell (negates main's padding). */
export default async function ChartPage({ searchParams }: Props) {
  const asset = findAsset((await searchParams).ma ?? "BTC") ?? findAsset("BTC");
  const symbols = MARKET_ASSETS.map((a) => a.symbol);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-var(--ds-shell-top))] min-h-[560px] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-outline-subtle bg-surface-lowest px-4 py-2">
        <h1 className="label-caps text-accent">Biểu đồ kỹ thuật</h1>
        <p className="font-mono text-[11px] text-text-muted" data-testid="chart-attribution">
          Nến cặp USD pháp định · nguồn Coinbase (dự phòng Kraken) · giá tham khảo, không phải báo giá giao dịch · không phải lời khuyên đầu tư
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <ChartTerminal symbol={asset?.symbol ?? "BTC"} symbols={symbols} />
      </div>
    </div>
  );
}
