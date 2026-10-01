import { MarketNotice } from "@/components/market/MarketNotice";
import { MarketTable } from "@/components/market/MarketTable";
import { SourceStatusList } from "@/components/market/SourceStatusList";
import { Panel } from "@/components/ui/Panel";
import { marketOverview } from "@/lib/market/instance";

export default async function MarketsPage() {
  const overview = await marketOverview();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Thị trường</h1>
        <Panel title="Giá tham khảo · VNĐ" aside={<span className="label-caps text-text-muted">Trung vị nhiều nguồn</span>}>
          {overview.assets.length === 0 ? (
            <p role="status" className="text-[13px] text-text-muted">
              Dữ liệu tạm thời không khả dụng. Không có số liệu nào được hiển thị thay thế.
            </p>
          ) : (
            <MarketTable assets={overview.assets} />
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
  );
}
