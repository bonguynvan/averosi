import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveBadge, LivePricesProvider } from "@/components/market/LivePrices";
import { MarketNotice } from "@/components/market/MarketNotice";
import { MarketTable } from "@/components/market/MarketTable";
import { SourceStatusList } from "@/components/market/SourceStatusList";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Panel } from "@/components/ui/Panel";
import { marketOverview } from "@/lib/market/instance";

export const metadata: Metadata = {
  title: "Thị trường: giá tham khảo tài sản mã hóa bằng VNĐ",
  description: "Giá tham khảo BTC, ETH, BNB… quy đổi VNĐ, trung vị từ nhiều nguồn dữ liệu công khai. Không phải báo giá giao dịch.",
};

async function MarketContent() {
  const overview = await marketOverview();
  const vndPerUsd = overview.fx.status === "ok" ? Number(overview.fx.rateVnd) : null;
  return (
    <LivePricesProvider>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Thị trường</h1>
        <Panel title="Giá tham khảo · VNĐ" aside={<LiveBadge />}>
          {overview.assets.length === 0 ? (
            <p role="status" className="text-[13px] text-text-muted">
              Dữ liệu tạm thời không khả dụng. Không có số liệu nào được hiển thị thay thế.
            </p>
          ) : (
            <MarketTable assets={overview.assets} vndPerUsd={vndPerUsd} />
          )}
          <div className="mt-3 border-t border-outline-subtle pt-3">
            <SourceStatusList sources={overview.sources} fx={overview.fx} />
          </div>
        </Panel>
      </div>
      <aside className="flex flex-col gap-4" aria-label="Phương pháp và lưu ý">
        <MarketNotice />
      </aside>
    </div>
    </LivePricesProvider>
  );
}

export default function MarketsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketContent />
    </Suspense>
  );
}
