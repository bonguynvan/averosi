import { type AssetInfo, findAsset, formatUsdMicros, formatVnd, formatVndCompact } from "@app/core";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Change } from "@/components/market/Change";
import { MarketNotice } from "@/components/market/MarketNotice";
import { PriceChart } from "@/components/market/PriceChart";
import { SourceStatusList } from "@/components/market/SourceStatusList";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Panel } from "@/components/ui/Panel";
import { marketOverview } from "@/lib/market/instance";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const asset = findAsset((await params).symbol);
  return asset ? { title: `${asset.name} (${asset.symbol}): giá tham khảo VNĐ` } : {};
}

export default async function AssetPage({ params }: Props) {
  // Validate before any streaming starts so unknown symbols return a real 404.
  const asset = findAsset((await params).symbol);
  if (!asset) notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssetContent asset={asset} />
    </Suspense>
  );
}

async function AssetContent({ asset }: { asset: AssetInfo }) {
  const overview = await marketOverview();
  const snapshot = overview.assets.find((a) => a.symbol === asset.symbol);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <nav aria-label="Đường dẫn" className="font-mono text-[12px] text-text-muted">
          <Link href="/thi-truong" className="hover:text-accent">
            Thị trường
          </Link>{" "}
          / <span className="text-text">{asset.symbol}</span>
        </nav>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-[22px] leading-7 font-bold text-text">
              {asset.name} <span className="text-text-muted">({asset.symbol})</span>
            </h1>
            <p className="label-caps mt-1 text-text-muted">Giá tham khảo · không phải báo giá giao dịch</p>
          </div>
          {snapshot ? (
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right font-mono text-[13px]" data-testid="asset-price">
              <dt className="text-left text-text-muted">VNĐ</dt>
              <dd className="text-[18px] font-semibold text-accent-soft">{snapshot.priceVnd === null ? "—" : formatVnd(snapshot.priceVnd)}</dd>
              <dt className="text-left text-text-muted">USD</dt>
              <dd>{formatUsdMicros(snapshot.priceUsdMicros)}</dd>
              <dt className="text-left text-text-muted">24h</dt>
              <dd>
                <Change bps={snapshot.change24hBps} />
              </dd>
              <dt className="text-left text-text-muted">KL 24h*</dt>
              <dd className="text-text-muted">{snapshot.volume24hVnd === null ? "—" : formatVndCompact(snapshot.volume24hVnd)}</dd>
            </dl>
          ) : (
            <p role="status" className="text-[13px] text-text-muted">
              Giá tạm thời không khả dụng.
            </p>
          )}
        </header>

        <Panel title="Biểu đồ giá (USD)">
          <PriceChart symbol={asset.symbol} />
        </Panel>

        <Panel title="Nguồn dữ liệu">
          {snapshot && (
            <p className="mb-2 font-mono text-[12px] text-text-muted">
              Tổng hợp từ {snapshot.sources.join(", ")} · độ lệch lớn nhất giữa các nguồn {(snapshot.maxDeviationBps / 100).toFixed(2).replace(".", ",")}%
            </p>
          )}
          <SourceStatusList sources={overview.sources} fx={overview.fx} />
        </Panel>
      </div>
      <aside className="flex flex-col gap-4" aria-label="Phương pháp và lưu ý">
        <MarketNotice />
      </aside>
    </div>
  );
}
