"use client";

import { SUPPORTED_CHAINS, explorerAddressUrl, formatUnits } from "@app/core";
import { type FormEvent, useCallback, useId, useState } from "react";
import { useAccount } from "wagmi";
import type { SerializedApprovalReport } from "@/lib/approvals/service";
import { chainKeyForId } from "@/lib/web3/config";
import { RevokeButton } from "./RevokeButton";

type Done = Extract<SerializedApprovalReport, { status: "complete" | "partial" }>;
type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "done"; report: SerializedApprovalReport };

const KIND_LABEL = { erc20: "ERC-20", "nft-all": "NFT · toàn bộ", permit2: "Permit2" } as const;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ERROR_TEXT: Record<string, string> = {
  RATE_LIMITED: "Bạn quét quá nhanh. Vui lòng đợi một phút.",
  INVALID_REQUEST: "Địa chỉ hoặc mạng không hợp lệ.",
  UNAVAILABLE: "Không quét được lúc này (nhà cung cấp dữ liệu không phản hồi). Thử lại sau.",
};

function amountText(a: Done["approvals"][number]): string {
  if (a.kind === "nft-all") return "Toàn bộ bộ sưu tập";
  if (a.unlimited) return "Không giới hạn";
  if (a.amount === null) return "—";
  return a.token.decimals === null ? a.amount : formatUnits(BigInt(a.amount), a.token.decimals, 4);
}

export function ApprovalChecker() {
  const id = useId();
  const { address, chainId, status } = useAccount();
  const connectedChain = chainKeyForId(chainId);
  const [state, setState] = useState<State>({ status: "idle" });
  const [query, setQuery] = useState<{ chain: string; address: string } | null>(null);

  const run = useCallback(async (q: { chain: string; address: string }, fresh = false) => {
    setQuery(q);
    setState({ status: "loading" });
    const res = await fetch("/api/quyen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...q, fresh }) }).catch(() => null);
    if (!res) return setState({ status: "error", message: ERROR_TEXT.UNAVAILABLE as string });
    const body = (await res.json().catch(() => ({}))) as SerializedApprovalReport & { error?: string };
    if (!res.ok) return setState({ status: "error", message: ERROR_TEXT[body.error ?? ""] ?? (ERROR_TEXT.UNAVAILABLE as string) });
    setState({ status: "done", report: body });
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void run({ chain: String(data.get("chain")), address: String(data.get("address")).trim() });
  };

  const refresh = useCallback(() => {
    if (query) void run(query, true);
  }, [query, run]);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end" aria-describedby={`${id}-hint`}>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-text-muted">Mạng</span>
          <select name="chain" key={connectedChain ?? "ethereum"} defaultValue={connectedChain ?? "ethereum"} className="border border-outline bg-canvas px-2 py-2 font-mono text-[13px] text-text outline-none focus:border-accent">
            {SUPPORTED_CHAINS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-caps text-text-muted">Địa chỉ ví</span>
          <input name="address" required spellCheck={false} autoComplete="off" key={address ?? "none"} defaultValue={status === "connected" ? address : ""} placeholder="0x…" className="w-full border border-outline bg-canvas px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-accent" />
        </label>
        <button type="submit" disabled={state.status === "loading"} className="label-caps bg-accent px-4 py-2.5 text-text-on-accent hover:opacity-90 disabled:opacity-60">
          {state.status === "loading" ? "Đang quét…" : "Quét quyền"}
        </button>
      </form>
      <p id={`${id}-hint`} className="text-[12px] text-text-muted">
        Quét toàn bộ lịch sử sự kiện cấp quyền của ví, sau đó đọc lại quyền hiện tại trên blockchain. Chỉ hiển thị quyền còn hiệu lực.
      </p>

      <div aria-live="polite">
        {state.status === "error" && (
          <p role="alert" className="border-l-2 border-danger bg-danger-container px-3 py-2 text-[13px] text-text">
            {state.message}
          </p>
        )}
        {state.status === "done" && state.report.status === "unconfigured" && (
          <p className="border-l-2 border-warning bg-surface-low px-3 py-2 text-[13px] text-text" data-testid="approvals-unconfigured">
            Mạng này chưa được cấu hình nguồn dữ liệu lưu trữ (archive) nên chưa quét được toàn bộ lịch sử.
          </p>
        )}
        {state.status === "done" && state.report.status !== "unconfigured" && <Results report={state.report} onRevoked={refresh} />}
      </div>
    </div>
  );
}

function Results({ report, onRevoked }: { report: Done; onRevoked: () => void }) {
  return (
    <section className="animate-enter flex flex-col gap-3" data-testid="approvals-result" data-status={report.status}>
      <p className="font-mono text-[12px] text-text-muted">
        {report.status === "complete" ? "Đã quét toàn bộ lịch sử" : `Quét một phần: block ${report.scannedFrom} → ${report.scannedTo} (mới nhất trước)`} · {report.candidates} cặp
        đã kiểm tra · <span className="text-text">{report.approvals.length} quyền còn hiệu lực</span>
      </p>
      {report.approvals.length === 0 ? (
        <p className="border border-dashed border-outline-subtle px-4 py-6 text-center text-[14px] text-text-muted">Không có quyền nào còn hiệu lực.</p>
      ) : (
        <div className="overflow-x-auto border border-outline-subtle">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="label-caps bg-surface text-left text-text-muted">
                <th className="px-3 py-2 font-bold">Token</th>
                <th className="px-3 py-2 font-bold">Được cấp cho</th>
                <th className="px-3 py-2 text-right font-bold">Mức quyền</th>
                <th className="px-3 py-2 text-right font-bold">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {report.approvals.map((a) => {
                const flagged = a.spender.flags.sanctioned || a.spender.flags.phishing;
                return (
                  <tr key={`${a.kind}:${a.token.address}:${a.spender.address}`} className={`border-t border-outline-subtle align-top ${flagged ? "bg-danger-container" : ""}`} data-testid="approval-row">
                    <td className="px-3 py-2">
                      <a href={explorerAddressUrl(report.chain, a.token.address)} target="_blank" rel="noopener noreferrer" className="font-semibold text-text hover:text-accent">
                        {a.token.symbol ?? short(a.token.address)} ↗
                      </a>
                      <span className="block text-[10px] text-text-muted">{KIND_LABEL[a.kind]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <a href={explorerAddressUrl(report.chain, a.spender.address)} target="_blank" rel="noopener noreferrer" className="text-text hover:text-accent">
                        {short(a.spender.address)} ↗
                      </a>
                      <span className="block text-[10px] text-text-muted">
                        {a.spender.kind === "contract" ? "Hợp đồng" : a.spender.kind === "eoa" ? "Ví thường" : "—"}
                        {a.spender.upgradeable ? " · nâng cấp được" : ""}
                      </span>
                      {a.spender.flags.sanctioned && <span className="block text-[11px] text-danger">Trừng phạt OFAC</span>}
                      {a.spender.flags.phishing && <span className="block text-[11px] text-danger">Bị báo cáo lừa đảo</span>}
                    </td>
                    <td className={`px-3 py-2 text-right ${a.unlimited ? "text-warning" : "text-text"}`}>
                      {amountText(a)}
                      {a.expiration !== null && <span className="block text-[10px] text-text-muted">hết hạn {new Date(a.expiration * 1000).toLocaleDateString("vi-VN")}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <RevokeButton approval={a} report={report} onRevoked={onRevoked} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
