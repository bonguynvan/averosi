"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useAccount, useConnect, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { SUPPORTED_WALLET_CHAINS, chainKeyForId } from "@/lib/web3/config";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Never asks for signatures, seed phrases or transfers — said explicitly, as an anti-phishing cue. */
const SAFETY = "Chỉ đọc địa chỉ ví. Không bao giờ yêu cầu chữ ký, cụm từ khôi phục hay chuyển tiền.";

export function ConnectWallet() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { address, chainId, status } = useAccount();
  const { connect, isPending, error } = useConnect();
  const connectors = useConnectors(); // reactive: includes wallets announced later via EIP-6963
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainKey = chainKeyForId(chainId);
  // EIP-6963-announced wallets first; the generic injected connector only when a legacy window.ethereum exists.
  const announced = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const hasLegacyProvider = typeof window !== "undefined" && "ethereum" in window && Boolean((window as { ethereum?: unknown }).ethereum);
  const wallets = announced.length > 0 ? announced : connectors.filter((c) => c.id === "injected" && hasLegacyProvider);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const label = status === "connected" && address ? short(address) : isPending ? "Đang kết nối…" : "Kết nối ví";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        data-testid="connect-wallet"
        className={`label-caps flex items-center gap-2 border px-3 py-1.5 transition-colors duration-[var(--ds-duration-fast)] ${
          status === "connected" ? "border-outline text-text hover:border-accent" : "border-accent text-accent hover:bg-accent-tint"
        }`}
      >
        {status === "connected" && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-led ${chainKey ? "bg-success" : "bg-warning"}`} />}
        {label}
      </button>

      {open && (
        <div id={`${id}-menu`} role="dialog" aria-label="Ví" className="animate-enter absolute right-0 z-40 mt-2 w-80 border border-outline bg-surface-lowest p-3 shadow-none">
          {status === "connected" && address ? (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-[12px] break-all text-text">{address}</p>
              {!chainKey ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-warning">Mạng hiện tại chưa được hỗ trợ. Chuyển sang:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUPPORTED_WALLET_CHAINS.map((c) => (
                      <button key={c.id} type="button" onClick={() => switchChain({ chainId: c.id })} className="label-caps border border-outline-subtle px-2 py-1 text-text-muted hover:border-accent hover:text-accent">
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <Link href={`/vi?ket-noi=1`} onClick={() => setOpen(false)} className="label-caps bg-accent px-3 py-2 text-center text-text-on-accent hover:opacity-90">
                    Theo dõi ví này
                  </Link>
                  <Link href="/rui-ro" onClick={() => setOpen(false)} className="label-caps border border-outline-subtle px-3 py-2 text-center text-text-muted hover:border-accent hover:text-accent">
                    Kiểm tra rủi ro
                  </Link>
                </div>
              )}
              <button type="button" onClick={() => disconnect()} className="label-caps self-start text-text-muted hover:text-danger">
                Ngắt kết nối
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {wallets.length === 0 ? (
                <p className="text-[13px] leading-5 text-text-muted" data-testid="no-wallet">
                  Không tìm thấy ví trên trình duyệt này. Hãy dùng tiện ích ví (extension) hoặc mở trang bằng trình duyệt bên trong ứng dụng ví.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {wallets.map((c) => (
                    <li key={c.uid}>
                      <button
                        type="button"
                        onClick={() => connect({ connector: c }, { onSuccess: () => setOpen(false) })}
                        className="flex w-full items-center gap-3 border border-outline-subtle px-3 py-2 text-left font-mono text-[13px] text-text hover:border-accent"
                      >
                        {c.icon ? <img src={c.icon} alt="" width={20} height={20} /> : <span aria-hidden="true" className="h-5 w-5 bg-surface-high" />}
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <p role="alert" className="text-[12px] text-danger">Kết nối không thành công hoặc đã bị từ chối.</p>}
            </div>
          )}
          <p className="mt-3 border-t border-outline-subtle pt-2 text-[11px] leading-4 text-text-muted">{SAFETY}</p>
        </div>
      )}
    </div>
  );
}
