import type { FxStatus, SourceStatus } from "@app/core";
import { formatVnd } from "@app/core";

const time = (d: Date) => d.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export function SourceStatusList({ sources, fx }: { sources: readonly SourceStatus[]; fx: FxStatus }) {
  return (
    <ul className="space-y-1 font-mono text-[11px] text-text-muted" data-testid="market-sources">
      <li>
        <span className={fx.status === "ok" ? "text-success" : "text-danger"}>{fx.status === "ok" ? "●" : "✕"}</span>{" "}
        {fx.status === "ok" ? `Tỷ giá ${formatVnd(fx.rateVnd)}/USD · ${fx.source} · ${time(fx.fetchedAt)}` : "Tỷ giá USD/VNĐ: không phản hồi, không hiển thị giá VNĐ"}
      </li>
      {sources.map((s) => (
        <li key={s.name}>
          <span className={s.status === "ok" ? "text-success" : "text-danger"}>{s.status === "ok" ? "●" : "✕"}</span> {s.name}
          {s.fetchedAt ? ` · ${time(s.fetchedAt)}` : " · không phản hồi"}
        </li>
      ))}
    </ul>
  );
}
