import { type AccountProfile, type AddressListSource, type ChainKey, type ChainReader, type EvmAddress, type Sourced, sourced } from "@app/core";
import { erc20Abi } from "viem";

type Hex = `0x${string}`;

export interface TokenInfo {
  readonly symbol: string;
  readonly address: Hex;
  readonly decimals: number;
}

/** Major stablecoins per chain — symbol/decimals verified on-chain (2026-10-01). Amounts only, never converted to VND (R2). */
export const STABLE_TOKENS: Readonly<Record<ChainKey, readonly TokenInfo[]>> = {
  ethereum: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  ],
  base: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
  ],
  bsc: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  ],
};

export interface TokenBalance {
  readonly symbol: string;
  readonly contract: string;
  readonly decimals: number;
  /** null when the call failed (shown as "—", never as 0). */
  readonly balance: bigint | null;
}

type MulticallResult = { status: "success"; result: unknown } | { status: "failure"; error: unknown };
export interface MulticallClient {
  multicall(args: { contracts: readonly unknown[]; allowFailure: true }): Promise<readonly MulticallResult[]>;
}

export interface TokenReader {
  balances(chain: ChainKey, address: EvmAddress): Promise<Sourced<readonly TokenBalance[]>>;
}

export function createTokenReader({ clientFor, now = () => new Date() }: { clientFor: (chain: ChainKey) => MulticallClient; now?: () => Date }): TokenReader {
  return {
    async balances(chain, address) {
      const tokens = STABLE_TOKENS[chain];
      const results = await clientFor(chain).multicall({
        contracts: tokens.map((t) => ({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [address] })),
        allowFailure: true,
      });
      const data = tokens.map((t, i) => {
        const r = results[i];
        return { symbol: t.symbol, contract: t.address, decimals: t.decimals, balance: r?.status === "success" && typeof r.result === "bigint" ? r.result : null };
      });
      return sourced(data, `RPC ${chain}`, now());
    },
  };
}

export interface WalletView {
  readonly chain: ChainKey;
  readonly address: EvmAddress;
  readonly account: AccountProfile | null;
  readonly tokens: readonly TokenBalance[] | null;
  readonly flags: { readonly sanctioned: boolean | null; readonly phishing: boolean | null };
  readonly fetchedAt: number;
}

export interface WalletServiceDeps {
  readonly chainReader: ChainReader;
  readonly sanctions: AddressListSource;
  readonly phishing: AddressListSource;
  readonly tokens: TokenReader;
  readonly ttlMs: number;
  readonly now?: () => number;
}

const orNull = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

/** Public-wallet snapshot: balances, activity and public risk flags. Cached per chain+address (never per visitor). */
export function createWalletService(deps: WalletServiceDeps) {
  const now = deps.now ?? Date.now;
  let cache = new Map<string, WalletView>();

  return {
    async read(query: { chain: ChainKey; address: EvmAddress }): Promise<WalletView> {
      const key = `${query.chain}:${query.address}`;
      const t = now();
      const hit = cache.get(key);
      if (hit && t - hit.fetchedAt < deps.ttlMs) return hit;

      const [account, tokens, sanctioned, phishing] = await Promise.all([
        orNull(deps.chainReader.accountProfile(query.chain, query.address)),
        orNull(deps.tokens.balances(query.chain, query.address)),
        orNull(deps.sanctions.contains(query.address)),
        orNull(deps.phishing.contains(query.address)),
      ]);
      const view: WalletView = {
        ...query,
        account: account?.data ?? null,
        tokens: tokens?.data ?? null,
        flags: { sanctioned: sanctioned?.data ?? null, phishing: phishing?.data ?? null },
        fetchedAt: t,
      };
      cache = new Map([...cache].filter(([, v]) => t - v.fetchedAt < deps.ttlMs)).set(key, view);
      return view;
    },
  };
}

export type SerializedWalletView = Omit<WalletView, "account" | "tokens"> & {
  readonly account: (Omit<AccountProfile, "balanceWei"> & { readonly balanceWei: string }) | null;
  readonly tokens: readonly (Omit<TokenBalance, "balance"> & { readonly balance: string | null })[] | null;
};

export function serializeWalletView(view: WalletView): SerializedWalletView {
  return {
    ...view,
    account: view.account ? { ...view.account, balanceWei: view.account.balanceWei.toString() } : null,
    tokens: view.tokens ? view.tokens.map((t) => ({ ...t, balance: t.balance === null ? null : t.balance.toString() })) : null,
  };
}
