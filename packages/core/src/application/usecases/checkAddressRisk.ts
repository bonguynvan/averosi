import type { EvmAddress } from "../../domain/address";
import type { ChainKey } from "../../domain/chains";
import { type AccountProfile, type CheckOutcome, type RiskAssessment, scoreRisk } from "../../domain/risk";
import type { Sourced } from "../../domain/sourced";
import type { AddressListSource, ChainReader } from "../ports";

export interface CheckAddressRiskDeps {
  readonly sanctions: AddressListSource;
  readonly phishing: AddressListSource;
  readonly chainReader: ChainReader;
}

export interface CheckAddressRiskQuery {
  readonly chain: ChainKey;
  readonly address: EvmAddress;
}

export interface SourceStatus {
  readonly name: string;
  readonly status: "ok" | "failed";
  readonly fetchedAt?: Date;
}

export interface AddressRiskReport extends RiskAssessment {
  readonly chain: ChainKey;
  readonly address: EvmAddress;
  readonly account: AccountProfile | null;
  readonly sources: readonly SourceStatus[];
}

async function settle<T>(name: string, run: () => Promise<Sourced<T>>): Promise<CheckOutcome<T>> {
  try {
    const result = await run();
    return { status: "ok", value: result.data, source: result.source, fetchedAt: result.fetchedAt };
  } catch {
    return { status: "failed", source: name };
  }
}

function toStatus(outcome: CheckOutcome<unknown>): SourceStatus {
  return outcome.status === "ok"
    ? { name: outcome.source, status: "ok", fetchedAt: outcome.fetchedAt }
    : { name: outcome.source, status: "failed" };
}

/** Runs every check in parallel; a failing source degrades the report instead of failing it. */
export async function checkAddressRisk(deps: CheckAddressRiskDeps, query: CheckAddressRiskQuery): Promise<AddressRiskReport> {
  const [sanctions, phishing, account] = await Promise.all([
    settle(deps.sanctions.name, () => deps.sanctions.contains(query.address)),
    settle(deps.phishing.name, () => deps.phishing.contains(query.address)),
    settle(`RPC ${query.chain}`, () => deps.chainReader.accountProfile(query.chain, query.address)),
  ]);

  return {
    ...scoreRisk({ sanctions, phishing, account }),
    chain: query.chain,
    address: query.address,
    account: account.status === "ok" ? account.value : null,
    sources: [sanctions, phishing, account].map(toStatus),
  };
}
