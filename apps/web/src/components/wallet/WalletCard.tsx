"use client";

import { chainInfo, explorerAddressUrl, formatUnits, formatVnd } from "@app/core";
import Link from "next/link";
import type { SerializedWalletView } from "@/lib/wallet/portfolio";
import type { WatchedWallet } from "@/lib/wallet/watchlist";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface WalletCardProps {
  readonly wallet: WatchedWallet;
  readonly view: SerializedWalletView | undefined;
  readonly nativeUsd: number | undefined;
  readonly vndPerUsd: number | null;
  readonly onRemove: () => void;
  readonly onAcknowledge: (txCount: number) => void;
}

export function WalletCard({ wallet, view, nativeUsd, vndPerUsd, onRemove, onAcknowledge }: WalletCardProps) {
  const chain = chainInfo(wallet.chain);
  const account = view?.account ?? null;
  const newTx = account && wallet.lastTxCount !== undefined ? account.txCount - wallet.lastTxCount : 0;
  const balanceWei = account ? BigInt(account.balanceWei) : null;
  const vndValue =
    balanceWei !== null && nativeUsd && vndPerUsd ? formatVnd(BigInt(Math.round((Number(balanceWei) / 10 ** chain.nativeDecimals) * nativeUsd * vndPerUsd))) : null;
  const flagged = view?.flags.sanctioned || view?.flags.phishing;

  return (
    <article data-testid="wallet-card" data-reveal className={`flex flex-col gap-3 border bg-surface-low p-4 ${flagged ? "border-danger" : "border-outline-subtle"}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[15px] font-semibold text-text">{wallet.note ?? short(wallet.address)}</p>
          <a href={explorerAddressUrl(wallet.chain, wallet.address)} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] break-all text-text-muted hover:text-accent">
            {wallet.address} ↗
          </a>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-caps border border-outline px-1.5 py-0.5 text-text-muted">{chain.name}</span>
          <button type="button" onClick={onRemove} aria-label={`Bỏ theo dõi ${wallet.note ?? wallet.address}`} className="label-caps border border-outline-subtle px-2 py-0.5 text-text-muted hover:border-danger hover:text-danger">
            Bỏ
          </button>
        </div>
      </header>

      {flagged && (
        <p className="border-l-2 border-danger bg-danger-container px-3 py-2 text-[13px] text-text">
          {view?.flags.sanctioned && "Có trong danh sách trừng phạt OFAC. "}
          {view?.flags.phishing && "Bị báo cáo liên quan lừa đảo. "}
          <Link href="/rui-ro" className="text-accent underline">
            Kiểm tra chi tiết
          </Link>
        </p>
      )}

      {!view ? (
        <div aria-hidden="true" className="skeleton h-16" />
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
          <dt className="text-text-muted">Số dư {chain.nativeSymbol}</dt>
          <dd className="text-right text-text">
            {balanceWei === null ? "—" : formatUnits(balanceWei, chain.nativeDecimals)}
            {vndValue && <span className="block text-[11px] text-accent-soft">≈ {vndValue} (tham khảo)</span>}
          </dd>
          {(view.tokens ?? []).map((t) => (
            <div key={t.contract} className="contents">
              <dt className="text-text-muted">{t.symbol}</dt>
              <dd className="text-right text-text">{t.balance === null ? "—" : formatUnits(BigInt(t.balance), t.decimals, 2)}</dd>
            </div>
          ))}
          <dt className="text-text-muted">Giao dịch đã gửi</dt>
          <dd className="text-right text-text">
            {account ? account.txCount : "—"}
            {newTx > 0 && (
              <button type="button" onClick={() => account && onAcknowledge(account.txCount)} className="ml-2 border border-warning px-1.5 text-[11px] text-warning" data-testid="new-activity">
                +{newTx} mới · đã xem
              </button>
            )}
          </dd>
          <dt className="text-text-muted">Loại</dt>
          <dd className="text-right text-text-muted">{account ? (account.kind === "contract" ? "Hợp đồng" : account.delegatedTo ? "Ví thường (ủy quyền EIP-7702)" : "Ví thường") : "—"}</dd>
        </dl>
      )}
    </article>
  );
}
