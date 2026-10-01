import { chainInfo, explorerAddressUrl, formatUnits } from "@app/core";
import { FINDING_COPY, LEVEL_COPY } from "@/lib/risk/copy";
import type { SerializedRiskReport } from "@/lib/risk/service";

const TONE_CLASSES = {
  danger: "border-danger text-danger",
  warning: "border-warning text-warning",
  success: "border-success text-success",
  muted: "border-outline text-text-muted",
} as const;

const SEVERITY_MARK = { critical: "▲", warning: "■", info: "●" } as const;
const SEVERITY_CLASS = { critical: "text-danger", warning: "text-warning", info: "text-text-muted" } as const;

const formatTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export function RiskReport({ report }: { report: SerializedRiskReport }) {
  const level = LEVEL_COPY[report.level];
  const chain = chainInfo(report.chain);

  return (
    <article aria-labelledby="risk-level" className="flex flex-col gap-3" data-testid="risk-report" data-level={report.level}>
      <div className={`border-l-2 bg-surface px-3 py-3 ${TONE_CLASSES[level.tone]}`}>
        <h2 id="risk-level" className="label-caps">
          {level.label}
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-text-muted">{level.summary}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
        <dt className="text-text-muted">Mạng</dt>
        <dd>{chain.name}</dd>
        <dt className="text-text-muted">Địa chỉ</dt>
        <dd className="break-all">
          <a href={explorerAddressUrl(report.chain, report.address)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            {report.address} ↗
          </a>
        </dd>
        {report.account && (
          <>
            <dt className="text-text-muted">Loại</dt>
            <dd>{report.account.kind === "contract" ? `Hợp đồng (${report.account.bytecodeSize} byte)` : "Ví thường (EOA)"}</dd>
            {report.account.delegatedTo && (
              <>
                <dt className="text-text-muted">Ủy quyền cho</dt>
                <dd className="break-all">
                  <a href={explorerAddressUrl(report.chain, report.account.delegatedTo)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {report.account.delegatedTo} ↗
                  </a>
                </dd>
              </>
            )}
            <dt className="text-text-muted">Số giao dịch đã gửi</dt>
            <dd>{report.account.txCount}</dd>
            <dt className="text-text-muted">Số dư</dt>
            <dd>
              {formatUnits(BigInt(report.account.balanceWei), chain.nativeDecimals)} {chain.nativeSymbol}
            </dd>
          </>
        )}
      </dl>

      {report.findings.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Phát hiện">
          {report.findings.map((f) => (
            <li key={`${f.id}-${f.source}`} className="border border-outline-subtle bg-surface-low px-3 py-2">
              <p className={`font-mono text-[13px] font-semibold ${SEVERITY_CLASS[f.severity]}`}>
                <span aria-hidden="true">{SEVERITY_MARK[f.severity]} </span>
                {FINDING_COPY[f.id].title}
                {f.id === "check-failed" && `: ${f.source}`}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-text-muted">{FINDING_COPY[f.id].detail}</p>
            </li>
          ))}
        </ul>
      )}

      <footer className="border-t border-outline-subtle pt-2 font-mono text-[11px] text-text-muted">
        <p className="label-caps mb-1">Nguồn dữ liệu</p>
        <ul>
          {report.sources.map((s) => (
            <li key={s.name}>
              <span className={s.status === "ok" ? "text-success" : "text-danger"}>{s.status === "ok" ? "●" : "✕"}</span> {s.name}
              {s.fetchedAt ? ` · cập nhật ${formatTime(s.fetchedAt)}` : " · không phản hồi"}
            </li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
