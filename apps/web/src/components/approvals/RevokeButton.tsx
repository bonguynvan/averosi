"use client";

import { PERMIT2_ADDRESS, explorerAddressUrl } from "@app/core";
import { useEffect, useState } from "react";
import { erc20Abi, parseAbi } from "viem";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { SerializedApprovalReport } from "@/lib/approvals/service";
import { SUPPORTED_WALLET_CHAINS, chainKeyForId } from "@/lib/web3/config";

type Report = Extract<SerializedApprovalReport, { status: "complete" | "partial" }>;
type Approval = Report["approvals"][number];

const NFT_ABI = parseAbi(["function setApprovalForAll(address operator, bool approved)"]);
const PERMIT2_ABI = parseAbi(["struct TokenSpenderPair { address token; address spender; }", "function lockdown(TokenSpenderPair[] approvals)"]);

/** Human-readable description of the exact call the wallet will be asked to sign. */
export function revokeCallLabel(a: Approval): string {
  if (a.kind === "erc20") return `approve(${a.spender.address}, 0) trên hợp đồng token`;
  if (a.kind === "nft-all") return `setApprovalForAll(${a.spender.address}, false) trên bộ sưu tập`;
  return `lockdown([{token, spender}]) trên Permit2`;
}

const CHAIN_IDS = Object.fromEntries(SUPPORTED_WALLET_CHAINS.map((c) => [chainKeyForId(c.id), c.id])) as Record<string, number>;

/**
 * Revoke one approval with the visitor's own wallet (R12): explicit click, exact call shown first,
 * only for the connected owner on the right chain, fee-free for us (gas goes to the network).
 */
export function RevokeButton({ approval, report, onRevoked }: { approval: Approval; report: Report; onRevoked: () => void }) {
  const { address, chainId, status } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, query: { enabled: Boolean(hash) } });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (receipt.isSuccess) onRevoked();
  }, [receipt.isSuccess, onRevoked]);

  const isOwner = status === "connected" && address?.toLowerCase() === report.owner.toLowerCase();
  const onChain = chainKeyForId(chainId) === report.chain;

  if (!isOwner) return <span className="text-[11px] text-text-muted">Kết nối đúng ví chủ sở hữu để thu hồi</span>;
  if (!onChain) {
    return (
      <button type="button" onClick={() => switchChain({ chainId: CHAIN_IDS[report.chain] as 1 | 8453 | 56 })} className="label-caps border border-warning px-2 py-1 text-warning">
        Chuyển mạng để thu hồi
      </button>
    );
  }
  if (receipt.isSuccess) return <span className="label-caps text-success">Đã thu hồi</span>;
  if (hash) {
    return (
      <a href={`${explorerAddressUrl(report.chain, report.owner).replace(/\/address\/.*/, "")}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="label-caps text-accent">
        Đang chờ xác nhận ↗
      </a>
    );
  }

  const revoke = () => {
    const token = approval.token.address as `0x${string}`;
    const spender = approval.spender.address as `0x${string}`;
    if (approval.kind === "erc20") writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, 0n] });
    else if (approval.kind === "nft-all") writeContract({ address: token, abi: NFT_ABI, functionName: "setApprovalForAll", args: [spender, false] });
    else writeContract({ address: PERMIT2_ADDRESS as `0x${string}`, abi: PERMIT2_ABI, functionName: "lockdown", args: [[{ token, spender }]] });
  };

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="label-caps border border-danger px-3 py-1 text-danger hover:bg-danger-container">
        Thu hồi
      </button>
    );
  }

  return (
    <div className="flex max-w-xs flex-col gap-2 border border-outline bg-surface-lowest p-2 text-left" role="group" aria-label="Xác nhận thu hồi">
      <p className="font-mono text-[11px] break-all text-text">Ví sẽ yêu cầu bạn ký: {revokeCallLabel(approval)}</p>
      <p className="text-[11px] text-text-muted">Bạn trả phí gas cho mạng. Không có phí nào cho chúng tôi. Kiểm tra lại nội dung trong ví trước khi ký.</p>
      <div className="flex gap-2">
        <button type="button" onClick={revoke} disabled={isPending} className="label-caps bg-danger px-3 py-1 text-text-on-accent disabled:opacity-60">
          {isPending ? "Đang mở ví…" : "Ký thu hồi"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            reset();
          }}
          className="label-caps border border-outline-subtle px-3 py-1 text-text-muted"
        >
          Hủy
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] text-danger">Giao dịch bị từ chối hoặc lỗi.</p>}
    </div>
  );
}
