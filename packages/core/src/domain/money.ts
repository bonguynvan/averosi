import { type Result, err, ok } from "./result";

/** Amounts in VND are whole dong held as bigint — never floats. */
export type Vnd = bigint;

export type VndParseError = "EMPTY" | "INVALID";

const DIGITS_WITH_DOT_GROUPS = /^\d{1,3}(\.\d{3})*$|^\d+$/;

/** Parses user input such as "1.500.000" or "1500000" into whole dong. */
export function parseVndInput(input: string): Result<Vnd, VndParseError> {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (trimmed === "") return err("EMPTY");
  if (!DIGITS_WITH_DOT_GROUPS.test(trimmed)) return err("INVALID");
  return ok(BigInt(trimmed.replaceAll(".", "")));
}

/** Formats whole dong in Vietnamese style: 2.348.500.000 ₫ */
export function formatVnd(amount: Vnd): string {
  const sign = amount < 0n ? "-" : "";
  const digits = (amount < 0n ? -amount : amount).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped} ₫`;
}
