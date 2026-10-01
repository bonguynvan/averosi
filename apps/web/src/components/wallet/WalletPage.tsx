"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { chainKeyForId } from "@/lib/web3/config";
import { WalletWatch } from "./WalletWatch";

/** /vi client root: optionally adds the connected wallet when arriving from "Theo dõi ví này". */
export function WalletPage() {
  const params = useSearchParams();
  const { address, chainId, status } = useAccount();
  const chain = chainKeyForId(chainId);
  const fromConnect = params.get("ket-noi") === "1";

  const addRequest = useMemo(
    () => (fromConnect && status === "connected" && address && chain ? { chain, address, note: "Ví của tôi" } : null),
    [fromConnect, status, address, chain],
  );

  return (
    <div className="flex flex-col gap-4">
      {status === "connected" && address && chain && !fromConnect && (
        <p className="border-l-2 border-accent bg-surface-low px-3 py-2 text-[13px] text-text">
          Ví đang kết nối: <span className="font-mono">{address}</span> ·{" "}
          <a href="/vi?ket-noi=1" className="text-accent underline">
            Theo dõi ví này
          </a>
        </p>
      )}
      <WalletWatch addRequest={addRequest} />
    </div>
  );
}
