"use client";

import { useEffect } from "react";
import { useWatchlist, viewKey } from "@/lib/wallet/useWatchlist";
import { Panel } from "../ui/Panel";
import { AddWalletForm } from "./AddWalletForm";
import { WalletCard } from "./WalletCard";

const NATIVE_PRICE_SYMBOL = { ethereum: "ETH", base: "ETH", bsc: "BNB" } as const;
const time = (ms: number) => new Date(ms).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

/** Public-wallet watch: stored in this browser, refreshed every minute while visible. */
export function WalletWatch({ addRequest }: { addRequest?: { chain: string; address: string; note?: string } | null }) {
  const { state, refresh, add, remove, acknowledge } = useWatchlist();

  // External add requests (e.g. "watch my connected wallet").
  useEffect(() => {
    if (addRequest) add(addRequest);
  }, [addRequest]); // run once per request object; `add` is stable enough for this

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Thêm ví theo dõi">
        <AddWalletForm onAdd={add} />
      </Panel>

      <section aria-label="Ví đang theo dõi" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[12px] text-text-muted">
          <span>
            {state.list.length} ví · {state.updatedAt ? `cập nhật ${time(state.updatedAt)}` : "chưa cập nhật"} · tự làm mới mỗi phút
          </span>
          <button type="button" onClick={() => void refresh()} disabled={state.loading || state.list.length === 0} className="label-caps border border-outline-subtle px-3 py-1 text-text-muted hover:border-accent hover:text-accent disabled:opacity-50">
            {state.loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>

        {state.error && (
          <p role="alert" className="border-l-2 border-warning bg-surface-low px-3 py-2 text-[13px] text-text">
            {state.error === "RATE_LIMITED" ? "Làm mới quá nhanh, vui lòng đợi một phút." : "Không tải được dữ liệu blockchain. Thử lại sau."}
          </p>
        )}

        {state.list.length === 0 ? (
          <p className="border border-dashed border-outline-subtle px-4 py-8 text-center text-[14px] text-text-muted" data-testid="watch-empty">
            Chưa có ví nào. Thêm địa chỉ công khai bạn muốn theo dõi: số dư, stablecoin, giao dịch mới, cảnh báo rủi ro.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {state.list.map((w) => (
              <WalletCard
                key={viewKey(w.chain, w.address)}
                wallet={w}
                view={state.views.get(viewKey(w.chain, w.address))}
                nativeUsd={state.nativeUsd.get(NATIVE_PRICE_SYMBOL[w.chain])}
                vndPerUsd={state.vndPerUsd}
                onRemove={() => remove(w.chain, w.address)}
                onAcknowledge={(tx) => acknowledge(w.chain, w.address, tx)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
