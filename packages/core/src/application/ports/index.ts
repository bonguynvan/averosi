import type { EvmAddress } from "../../domain/address";
import type { Vnd } from "../../domain/money";
import type { Sourced } from "../../domain/sourced";

/** Read-only ports. No port may sign, send, or custody anything (LEGAL_REGISTER R1). */

export interface AssetQuote {
  readonly symbol: string;
  readonly name: string;
  /** USD price in micro-dollars (1e-6) to avoid floats. */
  readonly priceUsdMicros: bigint;
  readonly change24hBps: number;
  readonly volume24hUsdMicros: bigint;
}

export interface PriceSource {
  listQuotes(symbols: readonly string[]): Promise<Sourced<readonly AssetQuote[]>>;
}

export interface FxSource {
  /** SBV central USD/VND rate. Never OTC or stablecoin rates. */
  usdVndCentralRate(): Promise<Sourced<Vnd>>;
}

export interface ChainReader {
  nativeBalance(chain: string, address: EvmAddress): Promise<Sourced<bigint>>;
}

export interface RiskListHit {
  readonly list: string;
  readonly label: string;
}

export interface RiskListSource {
  lookup(address: EvmAddress): Promise<Sourced<readonly RiskListHit[]>>;
}

export interface Clock {
  now(): Date;
}
