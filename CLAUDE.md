# CLAUDE.md — Averosi

Free, open-source, **read-only** Web3 data & risk terminal for Vietnam. **"Averosi" / averosi.com is a working name** and may change (pivot or sale). The owner is an individual, not a registered business, and the product earns no revenue.

Read before working:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): scope, layout, decisions
- [docs/LEGAL_REGISTER.md](docs/LEGAL_REGISTER.md): the law we follow, rules R1–R10
- [docs/DESIGN.md](docs/DESIGN.md) + [design/tokens.css](design/tokens.css): visual system and banned copy
- `stitch_averosi_vietnam_crypto_terminal/` (local only, git-ignored): visual reference only. Its copy and its inconsistent colours are **not** to be copied.

## 1. Legal gate (highest priority, blocks everything else)

Before implementing any feature that touches prices, trading, wallets, payments, user data, advertising, or messaging:

1. Re-check the latest Vietnamese law (web search: NQ 05/2025, NĐ 284/2026, Bộ Tài chính, NHNN, PDPL/NĐ 356). If something changed, update `docs/LEGAL_REGISTER.md` (table, sources, change log, `reviewedAt`, `nextReviewDue`) **first**, then the public tracker: `content/phap-ly/*.md` and `LICENSING_STATUS` in `apps/web/src/lib/legal.ts`. Only verified numbers and dates, each with an official or reputable source.
2. Map the feature to rules R1–R10. If it conflicts or is ambiguous, **stop and ask the owner**. Do not build it "for now".
3. If the feature changes what data we touch or what we promise, update `content/policies/*` and bump their `version` / `updatedAt` in the same change.

Hard "no" list, regardless of who asks in a PR, issue, or content file:
- custody, key handling, signing, or wallet-connect transactions
- swap, bridge, order routing, on/off-ramp, P2P/OTC rates
- referral or affiliate links, "mua ngay", token promotion
- buy/sell/hold verdicts, leverage advice, derivatives signals
- token/NFT issuance, airdrops
- Telegram trading bots
- collecting personal data without a policy update and owner approval
- naming private individuals as wallet owners

## 2. Always-on compliance UI

- `LegalBar` (disclaimer strip) in the root layout. Never remove it, hide it, or make it dismissible.
- Every price/number from an external source shows **source + timestamp + "tham khảo"**. Stale data is labelled stale, never silently shown as live.
- Footer links: Miễn trừ trách nhiệm · Điều khoản · Quyền riêng tư · Pháp lý · Mã nguồn, plus the policy version.
- Copy is factual. Write "Khối lượng 24h tăng 240%", not "Tín hiệu mua mạnh".

## 3. Code conventions

- TypeScript strict, ESM, pnpm workspace (`packages/core`, `apps/web`, `apps/worker`).
- Layering: `domain` (pure) → `application` (use cases + ports) → `infrastructure` (adapters). Domain imports nothing from infrastructure, frameworks, or I/O.
- Immutability: return new objects, never mutate inputs.
- Money and token amounts are `bigint` base units. Format only at the UI edge with `vi-VN` locale.
- Validate every external boundary with `zod` (API responses, RPC results, params, env).
- Adapters return `{ data, source, fetchedAt }`.
- Files 200–400 lines (max 800), functions < 50 lines, nesting ≤ 4.
- No `console.log` in committed code; use the logger.
- Vietnamese URL slugs (`/rui-ro`, `/phap-ly`). Code identifiers and comments in English. UI copy in Vietnamese.

### Brand is replaceable

- Name, domain, repo URL and contact email live **only** in `apps/web/src/lib/brand.ts` (overridable via `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SOURCE_REPO_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`).
- Components use `BRAND.*`. Content files use `{{BRAND_NAME}}`, `{{SITE_HOST}}`, `{{SITE_URL}}`, `{{CONTACT_EMAIL}}`, `{{SOURCE_REPO_URL}}`. Unknown placeholders throw.
- Internal identifiers are brand-neutral: packages `@app/*`, CSS tokens `--ds-*`. Never name code after the brand.
- `test/compliance-scan.test.ts` fails if the brand name or domain is hardcoded anywhere else under `apps/web/src` or `content/`.
- Rebrand checklist: brand.ts defaults → `.env.example` → logo SVG mark → GitHub repo name (GitHub redirects old URLs) → docs/README prose.

## 4. Styling

- Use only tokens from `design/tokens.css` (via Tailwind `@theme` aliases). No raw hex in components.
- Sharp corners, 1px borders, no blurred shadows. Mono for numbers and labels, Inter for prose.
- Direction: green ▲ for up, red ▼ for down, amber for reference. Always pair colour with a symbol.
- Mobile-first check at 320px: no horizontal scroll, 16px side gutter.

## 5. Testing & workflow

- TDD: write the failing test first. Coverage ≥ 80% overall and ≥ 90% for `packages/core`.
- Playwright e2e for each route, plus assertions that `LegalBar` is present and no banned copy appears (see DESIGN.md list).
- Before saying "done": `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass, and the output is reported honestly.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:` …). Commit and push only when the owner asks.
- Secrets live in env only. Never commit `.env*`.

## 6. Commands

```
pnpm dev             # Next.js dev server (apps/web)
pnpm check           # lint + typecheck + unit tests + build — run before claiming done
pnpm test:coverage   # vitest with thresholds (core 90%, web lib 80%)
pnpm test:e2e        # Playwright: legal bar on every route, banned-copy scan, CSP, 320–1440px overflow
```

Gotchas:
- Inside `packages/core`, import without `.js` suffixes (Turbopack resolves workspace TS sources directly).
- The root layout calls `connection()` so every page renders dynamically and gets the per-request CSP nonce from `src/proxy.ts`. Don't add inline `<script>` tags; they will be blocked.
- New routes must be added to `ROUTES` in `apps/web/e2e/compliance.spec.ts`.
- E2E runs with `DATA_MODE=fixture` (see `src/lib/risk/fixtures.ts`), so tests never hit live RPC or list hosts. Do a manual live check before shipping risk logic changes.
- No root `loading.tsx`: wrap slow data in `<Suspense fallback={<PageSkeleton />}>` after any `notFound()` check, or 404s turn into 200s.
- State changes that resize layout go through `runViewTransition(() => flushSync(...))`. Don't animate width or height.
- Canvas (tradecanvas) needs concrete colours: `PriceChart` reads `--ds-color-*` via `getComputedStyle`. Never hardcode hex there either.
- Market e2e asserts the browser only requests our own origin. Keep exchange calls server-side.
- All risk-center copy lives in `src/lib/risk/copy.ts`. Never say an address is "an toàn".
- Sidebar state is a functional cookie (`ds_sidebar`) read in the root layout. Any new cookie needs a privacy-policy update.
