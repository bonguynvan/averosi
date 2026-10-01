import type { EvmAddress } from "../../domain/address";
import type { ChainKey } from "../../domain/chains";
import type { Vnd } from "../../domain/money";
import type { AccountProfile } from "../../domain/risk";
import type { Sourced } from "../../domain/sourced";

export type { AccountProfile };

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
  accountProfile(chain: ChainKey, address: EvmAddress): Promise<Sourced<AccountProfile>>;
}

/** A public address list (sanctions, phishing reports). `name` is shown to users as the source. */
export interface AddressListSource {
  readonly name: string;
  contains(address: EvmAddress): Promise<Sourced<boolean>>;
}

export interface Clock {
  now(): Date;
}
