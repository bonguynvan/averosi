import { parseEvmAddress, type EvmAddress } from "@app/core";
import { describe, expect, test } from "vitest";
import { EIP1967_IMPLEMENTATION_SLOT, PROXY_SLOTS, type RpcClient, createChainReader } from "@/lib/risk/chainReader";

const ADDRESS = (() => {
  const r = parseEvmAddress("0x1111111111111111111111111111111111111111");
  if (!r.ok) throw new Error("fixture");
  return r.value as EvmAddress;
})();

function client(overrides: Partial<RpcClient> = {}): RpcClient {
  return {
    getCode: async () => undefined,
    getTransactionCount: async () => 5,
    getBalance: async () => 42n,
    getStorageAt: async () => `0x${"0".repeat(64)}`,
    ...overrides,
  };
}

describe("createChainReader", () => {
  const now = () => new Date(0);

  test("EOA: no code", async () => {
    const reader = createChainReader({ clientFor: () => client(), now });
    const result = await reader.accountProfile("ethereum", ADDRESS);
    expect(result).toEqual({
      data: { kind: "eoa", txCount: 5, balanceWei: 42n, isUpgradeableProxy: false, bytecodeSize: 0 },
      source: "RPC ethereum",
      fetchedAt: new Date(0),
    });
  });

  test("contract with EIP-1967 implementation slot set is flagged as proxy", async () => {
    const askedSlots: string[] = [];
    const reader = createChainReader({
      clientFor: () =>
        client({
          getCode: async () => "0x60806040",
          getStorageAt: async ({ slot }) => {
            askedSlots.push(slot);
            return slot === EIP1967_IMPLEMENTATION_SLOT ? `0x${"0".repeat(24)}${"ab".repeat(20)}` : `0x${"0".repeat(64)}`;
          },
        }),
      now,
    });
    const { data } = await reader.accountProfile("base", ADDRESS);
    expect(askedSlots).toEqual([...PROXY_SLOTS]);
    expect(data).toMatchObject({ kind: "contract", isUpgradeableProxy: true, bytecodeSize: 4 });
  });

  test("contract with empty slot is not a proxy; '0x' code counts as EOA", async () => {
    const contract = createChainReader({ clientFor: () => client({ getCode: async () => "0x6080" }), now });
    expect((await contract.accountProfile("bsc", ADDRESS)).data).toMatchObject({ kind: "contract", isUpgradeableProxy: false });
    const empty = createChainReader({ clientFor: () => client({ getCode: async () => "0x" }), now });
    expect((await empty.accountProfile("bsc", ADDRESS)).data.kind).toBe("eoa");
  });

  test("detects proxies via any known slot (EIP-1967 impl/beacon, ZeppelinOS legacy as used by USDC)", async () => {
    expect(PROXY_SLOTS).toContain(EIP1967_IMPLEMENTATION_SLOT);
    const zos = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";
    const reader = createChainReader({
      clientFor: () =>
        client({
          getCode: async () => "0x6080",
          getStorageAt: async ({ slot }) => (slot === zos ? `0x${"0".repeat(24)}${"cd".repeat(20)}` : `0x${"0".repeat(64)}`),
        }),
      now,
    });
    expect((await reader.accountProfile("ethereum", ADDRESS)).data.isUpgradeableProxy).toBe(true);
  });

  test("EIP-7702 delegation designator (0xef0100 + address) is an EOA with a delegate", async () => {
    let storageReads = 0;
    const reader = createChainReader({
      clientFor: () =>
        client({
          getCode: async () => "0xef01005a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d",
          getStorageAt: async () => {
            storageReads += 1;
            return undefined;
          },
        }),
      now,
    });
    const { data } = await reader.accountProfile("ethereum", ADDRESS);
    expect(data).toMatchObject({ kind: "eoa", delegatedTo: "0x5a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d", isUpgradeableProxy: false });
    expect(storageReads).toBe(0);
  });

  test("propagates RPC errors to the caller", async () => {
    const reader = createChainReader({
      clientFor: () => client({ getBalance: async () => Promise.reject(new Error("rpc down")) }),
      now,
    });
    await expect(reader.accountProfile("ethereum", ADDRESS)).rejects.toThrow("rpc down");
  });
});
