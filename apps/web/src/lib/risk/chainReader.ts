import { type AccountProfile, type ChainKey, type ChainReader, type EvmAddress, sourced } from "@app/core";

/** keccak256("eip1967.proxy.implementation") - 1 */
export const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/** Storage slots that hold a proxy's implementation/beacon. Any non-zero value means the logic is replaceable. */
export const PROXY_SLOTS = [
  EIP1967_IMPLEMENTATION_SLOT,
  // keccak256("eip1967.proxy.beacon") - 1
  "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
  // keccak256("org.zeppelinos.proxy.implementation") — legacy OpenZeppelin, used by USDC
  "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
] as const;

/** EIP-7702 delegation designator: 0xef0100 ‖ 20-byte delegate address. */
const DELEGATION_PREFIX = "0xef0100";
const DELEGATION_HEX_LENGTH = 2 + (3 + 20) * 2;

type Hex = `0x${string}`;

/** The read-only subset of a viem PublicClient we rely on (keeps adapters testable). */
export interface RpcClient {
  getCode(args: { address: Hex }): Promise<Hex | undefined>;
  getTransactionCount(args: { address: Hex }): Promise<number>;
  getBalance(args: { address: Hex }): Promise<bigint>;
  getStorageAt(args: { address: Hex; slot: Hex }): Promise<Hex | undefined>;
}

export interface ChainReaderOptions {
  readonly clientFor: (chain: ChainKey) => RpcClient;
  readonly now?: () => Date;
}

const isNonZero = (hex: Hex | undefined): boolean => hex !== undefined && /[1-9a-f]/i.test(hex.slice(2));
const byteLength = (hex: Hex | undefined): number => (hex ? Math.max(0, (hex.length - 2) / 2) : 0);

function delegateOf(code: Hex | undefined): string | null {
  if (!code || code.length !== DELEGATION_HEX_LENGTH || !code.toLowerCase().startsWith(DELEGATION_PREFIX)) return null;
  return `0x${code.slice(DELEGATION_PREFIX.length).toLowerCase()}`;
}

export function createChainReader({ clientFor, now = () => new Date() }: ChainReaderOptions): ChainReader {
  return {
    async accountProfile(chain: ChainKey, address: EvmAddress) {
      const client = clientFor(chain);
      const target = address as Hex;
      const [code, txCount, balanceWei] = await Promise.all([
        client.getCode({ address: target }),
        client.getTransactionCount({ address: target }),
        client.getBalance({ address: target }),
      ]);
      const bytecodeSize = byteLength(code);
      const delegatedTo = delegateOf(code);
      const isContract = bytecodeSize > 0 && delegatedTo === null;
      const slots = isContract ? await Promise.all(PROXY_SLOTS.map((slot) => client.getStorageAt({ address: target, slot }))) : [];

      const profile: AccountProfile = {
        kind: isContract ? "contract" : "eoa",
        txCount,
        balanceWei,
        isUpgradeableProxy: slots.some(isNonZero),
        bytecodeSize,
        ...(delegatedTo ? { delegatedTo } : {}),
      };
      return sourced(profile, `RPC ${chain}`, now());
    },
  };
}
