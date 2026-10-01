import { topByVolume } from "@app/core";
import type { Metadata } from "next";
import { ChartTerminal } from "@/components/chart/ChartTerminal";
import { findMarketAsset, marketOverview } from "@/lib/market/instance";

export const metadata: Metadata = {
  title: "Biểu đồ kỹ thuật",
  description:
    "Biểu đồ nến đầy đủ: chỉ báo kỹ thuật, công cụ vẽ, nhiều kiểu biểu đồ và khung thời gian. Dữ liệu tham khảo từ cặp USD pháp định, chỉ đọc.",
};

/** Watchlist size: the most traded assets; any other asset opens via ?ma= (e.g. from /thi-truong). */
const WATCHLIST_SIZE = 50;

type Props = { searchParams: Promise<{ ma?: string }> };

/** Full-bleed chart terminal: fills the viewport below the sticky shell (negates main's padding). */
export default async function ChartPage({ searchParams }: Props) {
  const [requested, overview] = await Promise.all([
    findMarketAsset((await searchParams).ma ?? "BTC").catch(() => undefined),
    marketOverview().catch(() => null),
  ]);
  const symbol = requested?.symbol ?? "BTC";
  const top = topByVolume(overview?.assets ?? [], WATCHLIST_SIZE).map((a) => a.symbol);
  const symbols = top.includes(symbol) ? top : [symbol, ...top];

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-var(--ds-shell-top))] min-h-[560px] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-outline-subtle bg-surface-lowest px-4 py-2">
        <h1 className="label-caps text-accent">Biểu đồ kỹ thuật</h1>
        <p className="font-mono text-[11px] text-text-muted" data-testid="chart-attribution">
          Nến cặp USD pháp định · nguồn Coinbase (dự phòng Kraken, Bitstamp) · giá tham khảo, không phải báo giá giao dịch · không phải lời khuyên đầu tư
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <ChartTerminal symbol={symbol} symbols={symbols} />
      </div>
    </div>
  );
}
