import { type Result, err, ok } from "./result";

declare const evmAddressBrand: unique symbol;
/** Lower-cased 0x-prefixed 20-byte hex address. Checksum is not verified here. */
export type EvmAddress = string & { readonly [evmAddressBrand]: true };

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function parseEvmAddress(input: string): Result<EvmAddress, "INVALID_ADDRESS"> {
  const trimmed = input.trim();
  if (!EVM_ADDRESS.test(trimmed)) return err("INVALID_ADDRESS");
  return ok(trimmed.toLowerCase() as EvmAddress);
}
