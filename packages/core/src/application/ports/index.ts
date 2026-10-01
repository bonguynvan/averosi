import type { EvmAddress } from "../../domain/address";
import type { ChainKey } from "../../domain/chains";
import type { Vnd } from "../../domain/money";
import type { SourceQuote } from "../../domain/market";
import type { AccountProfile } from "../../domain/risk";
import type { Sourced } from "../../domain/sourced";

export type { AccountProfile };

/** Read-only ports. No port may sign, send, or custody anything (LEGAL_REGISTER R1). */

/** Public market data of one exchange (USD fiat pairs only). `name` is shown to users as the source. */
export interface MarketSource {
  readonly name: string;
  quotes(symbols: readonly string[]): Promise<Sourced<readonly SourceQuote[]>>;
}

export interface FxSource {
  /** Official USD/VND reference rate (bank-published or SBV). Never OTC or stablecoin rates (LEGAL_REGISTER R2). */
  usdVndRate(): Promise<Sourced<Vnd>>;
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
