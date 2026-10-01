import { BRAND } from "@/lib/brand";
import { LICENSING_STATUS } from "@/lib/legal";
import { Panel } from "../ui/Panel";
import { vnDate } from "./InstrumentCard";

export function LegalAside({ reviewedAt }: { reviewedAt: string }) {
  return (
    <aside className="flex flex-col gap-4" aria-label="Tình trạng cấp phép và lưu ý">
      <Panel title="Tình trạng cấp phép sàn">
        <p className="font-mono text-[14px] font-semibold text-warning" data-testid="licensing-status">
          {LICENSING_STATUS.headline}
        </p>
        <p className="mt-2 text-[13px] leading-5 text-text-muted">{LICENSING_STATUS.detail}</p>
        <p className="mt-2 font-mono text-[11px] text-text-muted">Cập nhật {vnDate(LICENSING_STATUS.asOf)}</p>
        <ul className="mt-2 space-y-1 font-mono text-[12px]">
          {LICENSING_STATUS.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {s.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Lưu ý">
        <ul className="list-inside list-disc space-y-1 text-[12px] leading-5 text-text-muted">
          <li>Tóm tắt mang tính thông tin, không phải tư vấn pháp lý. Luôn đối chiếu văn bản gốc.</li>
          <li>Nội dung được rà soát ít nhất 30 ngày một lần. Lần rà soát gần nhất: {vnDate(reviewedAt)}.</li>
          <li>
            Thấy sai sót?{" "}
            <a href={`${BRAND.sourceRepoUrl}/issues`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Báo trên GitHub ↗
            </a>
          </li>
        </ul>
      </Panel>
    </aside>
  );
}
