import type { Vnd } from "./money";
import { type Result, err, ok } from "./result";

/**
 * Personal income tax on each crypto-asset transfer: 0.1% of transfer value
 * (Thông tư 32/BTC, effective 2026-03-27; withheld by the licensed VASP).
 * Estimate only — see docs/LEGAL_REGISTER.md (L4).
 */
export const TRANSFER_TAX_RATE_BPS = 10n;
const BPS_DENOMINATOR = 10_000n;

export interface TransferTaxEstimate {
  readonly taxVnd: Vnd;
  readonly netVnd: Vnd;
}

export function estimateTransferTax(transferValueVnd: Vnd): Result<TransferTaxEstimate, "NEGATIVE"> {
  if (transferValueVnd < 0n) return err("NEGATIVE");
  const scaled = transferValueVnd * TRANSFER_TAX_RATE_BPS;
  const taxVnd = (scaled + BPS_DENOMINATOR / 2n) / BPS_DENOMINATOR;
  return ok({ taxVnd, netVnd: transferValueVnd - taxVnd });
}
