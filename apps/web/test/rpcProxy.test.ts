import { describe, expect, test } from "vitest";
import { RPC_PROXY_METHODS, parseProxyCall } from "@/lib/web3/rpcProxy";

describe("parseProxyCall (same-origin read-only RPC proxy)", () => {
  test("allows only the read methods needed to track a transaction", () => {
    expect([...RPC_PROXY_METHODS].sort()).toEqual(["eth_blockNumber", "eth_chainId", "eth_getTransactionByHash", "eth_getTransactionReceipt"]);
    expect(parseProxyCall({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [`0x${"ab".repeat(32)}`] })).toEqual({
      ok: true,
      value: { id: 1, method: "eth_getTransactionReceipt", params: [`0x${"ab".repeat(32)}`] },
    });
  });

  test("rejects signing, sending, state calls and log scans", () => {
    for (const method of ["eth_sendRawTransaction", "eth_sendTransaction", "eth_sign", "personal_sign", "eth_call", "eth_getLogs", "debug_traceTransaction"]) {
      expect(parseProxyCall({ jsonrpc: "2.0", id: 1, method, params: [] })).toEqual({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }
  });

  test("validates hashes and rejects batches or malformed bodies", () => {
    expect(parseProxyCall({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: ["0x12"] })).toEqual({ ok: false, error: "INVALID_PARAMS" });
    expect(parseProxyCall([{ jsonrpc: "2.0", id: 1, method: "eth_chainId" }])).toEqual({ ok: false, error: "INVALID_REQUEST" });
    expect(parseProxyCall(null)).toEqual({ ok: false, error: "INVALID_REQUEST" });
    expect(parseProxyCall({ jsonrpc: "2.0", id: 2, method: "eth_blockNumber" })).toEqual({ ok: true, value: { id: 2, method: "eth_blockNumber", params: [] } });
  });
});
