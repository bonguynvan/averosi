/**
 * Copy that must never ship (docs/DESIGN.md "Do not ship", LEGAL_REGISTER R3–R5).
 * Used by tests that scan UI source and content.
 */
export interface BannedCopyRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly reason: string;
}

export interface BannedCopyHit {
  readonly id: string;
  readonly match: string;
  readonly reason: string;
}

// Matches inside a clause that starts with a negation ("không ...") are allowed.
const NEGATED_CLAUSE = /không[^.;!?\n]*$/iu;

export const BANNED_COPY_RULES: readonly BannedCopyRule[] = [
  { id: "implied-supervision", pattern: /UBCKNN|tuân thủ thông tư/giu, reason: "Implies state supervision or licence" },
  { id: "fabricated-status", pattern: /\binstitutional\b|inst\. member/giu, reason: "Fabricated institutional status" },
  { id: "investment-advice", pattern: /khuyến nghị (mua|bán|nắm giữ|giao dịch)|averosi khuyến nghị/giu, reason: "Investment advice" },
  { id: "call-to-trade", pattern: /mua ngay|bán ngay|giao dịch ngay/giu, reason: "Call to trade" },
  { id: "otc-rate", pattern: /\bOTC\b|USDT\/VND/gu, reason: "Normalises unlicensed P2P/OTC trading" },
  { id: "referral-link", pattern: /[?&](ref|referral|aff)=/giu, reason: "Referral/affiliate link" },
];

export function findBannedCopy(text: string): BannedCopyHit[] {
  return BANNED_COPY_RULES.flatMap((rule) =>
    [...text.matchAll(rule.pattern)]
      .filter((m) => !NEGATED_CLAUSE.test(text.slice(0, m.index)))
      .map((m) => ({ id: rule.id, match: m[0], reason: rule.reason })),
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `dueDate` is an ISO date (YYYY-MM-DD); the review is overdue once that day has fully passed (UTC). */
export function isReviewOverdue(dueDate: string, now: Date): boolean {
  if (!ISO_DATE.test(dueDate) || Number.isNaN(Date.parse(dueDate))) {
    throw new Error(`Invalid review date: ${dueDate}`);
  }
  const endOfDue = Date.parse(`${dueDate}T23:59:59.999Z`);
  return now.getTime() > endOfDue;
}
