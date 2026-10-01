# Averosi — Architecture

**Averosi / averosi.com (working name; see `apps/web/src/lib/brand.ts`)**: a free, open-source, read-only Web3 data & risk terminal for Vietnamese users, aligned with Vietnam's digital-transformation direction. Legal constraints: [LEGAL_REGISTER.md](LEGAL_REGISTER.md). Design: [DESIGN.md](DESIGN.md).

## 1. Product scope

### v1 (free, no accounts)

| Module | Route | What it does | Data |
|---|---|---|---|
| Thị trường | `/` | Reference prices of major assets in USD and VND (converted at the SBV central rate), 24h change, volume. Tagged "giá tham khảo". | Global aggregator API + SBV rate |
| Chi tiết tài sản | `/tai-san/[symbol]` | Chart, supply, on-chain basics, links to official docs. No trade buttons. | Aggregator + public RPC |
| Trung tâm rủi ro | `/rui-ro` | Paste an address or contract and get a risk report: sanctions list hit, known-scam lists, token approvals, contract flags (honeypot/proxy/owner mint). Shows the methodology. | Public RPC, OFAC SDN, open scam lists |
| Theo dõi ví công khai | `/vi` | Watch public addresses: balances and recent transfers. Watchlist stored in `localStorage` only. | Public RPC / indexer |
| Pháp lý | `/phap-ly` | Readable tracker of Vietnamese crypto law with effective dates and source links, generated from `content/legal-tracker/`. | Repo content |
| Công cụ thuế | `/thue` | 0.1% transfer-tax calculator (client-side, nothing stored). | Pure function |
| Kiến thức | `/kien-thuc` | Education: self-custody safety, scam patterns, how the pilot market works. | MDX |
| Policies | `/mien-tru-trach-nhiem`, `/dieu-khoan`, `/quyen-rieng-tu` | Versioned legal pages. | `content/policies/` |

### Later (each needs a LEGAL_REGISTER review first)

- "Sự kiện dữ liệu" feed: factual on-chain/volume anomalies, no verdicts.
- Data from licensed VN exchanges once they publish public market-data APIs. These would replace global prices as the primary VND source.
- B2B: an open-source AML/risk-screening library for licensed VASPs (the risk-center engine, extracted).
- Non-financial blockchain verification (certificates, document hashes) for digital transformation.

### Never

Custody, signing, swaps, order routing, on/off-ramp, OTC/P2P rates, token issuance, referral links, trading signals, Telegram bots. See LEGAL_REGISTER R1–R10.

## 2. System overview

```
             Cloudflare (DNS, TLS, cache, WAF)
                            │
                  ┌─────────▼──────────┐
                  │  Caddy (VPS)       │
                  └─────────┬──────────┘
                            │
        ┌───────────────────▼─────────────────────┐
        │  apps/web — Next.js (App Router, RSC)   │
        │  pages · route handlers /api/* (GET)    │
        └───────┬───────────────────────┬─────────┘
                │ read                  │ read
        ┌───────▼───────┐       ┌───────▼────────┐
        │ Redis (cache) │◄──────┤ apps/worker    │  scheduled jobs:
        └───────────────┘ write │ (Node, cron)   │  prices 60s, SBV rate 1h,
                                └───────┬────────┘  risk lists 24h
                                        │
                     External read-only sources (HTTP/RPC)
         price aggregator · SBV · public RPC/indexer · OFAC · scam lists
```

- **No database in v1.** All state is either cache (Redis, rebuildable) or content (git). A Postgres instance is added only when a feature needs durable state, and that feature requires a legal review first because it probably means personal data.
- **Request path never calls external APIs directly** for hot data. The worker fills Redis, and the web layer reads Redis. Missing or stale cache shows "dữ liệu tạm thời không khả dụng" with the stale timestamp, never invented numbers.
- **Risk check** is on demand. The route handler calls RPC with a timeout and per-IP rate limit, then caches results by address for 10 minutes.

## 3. Repository layout

pnpm workspace. Same layering as quill-v2: domain → application → infrastructure.

```
averosi-v2/
├── CLAUDE.md
├── design/tokens.css                 # source of truth for colours/type/spacing
├── docs/                             # ARCHITECTURE, DESIGN, LEGAL_REGISTER, ADRs
├── content/
│   ├── policies/                     # disclaimer / terms / privacy (versioned MD)
│   ├── legal-tracker/                # one MD file per legal instrument (frontmatter)
│   └── kien-thuc/                    # education MDX
├── packages/
│   └── core/                         # pure TS, zero I/O, 100% unit-tested
│       └── src/
│           ├── domain/               # money (VND/bigint), asset, address, risk scoring, tax
│           └── application/
│               ├── ports/            # PriceSource, FxSource, ChainReader, RiskListSource, Cache, Clock
│               └── usecases/         # getMarketOverview, checkAddressRisk, computeTransferTax…
├── apps/
│   ├── web/                          # Next.js
│   │   └── src/
│   │       ├── app/                  # routes (Vietnamese slugs)
│   │       ├── components/           # by feature: market/, risk/, wallet/, legal/, ui/
│   │       ├── infrastructure/       # adapters implementing core ports (read-side)
│   │       └── styles/               # imports design/tokens.css, Tailwind v4 @theme
│   └── worker/                       # (added with the first data job) cron → adapters → Redis
├── test/e2e/                         # Playwright
└── docker/                           # compose, Caddyfile
```

## 4. Key technical decisions

| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript strict, ESM | One language end to end; matches quill-v2 |
| Web | Next.js App Router, RSC, ISR | SEO for Vietnamese content, server rendering of data |
| Styling | Tailwind v4 with `@theme` mapped to `design/tokens.css` variables | Tokens stay framework-agnostic |
| Chain access | `viem` (EVM first: Ethereum, Base, BNB Chain); Solana later | Typed, tree-shakable, read-only clients |
| Validation | `zod` at every external boundary (API responses, route params, query strings) | External data is untrusted |
| Money | `bigint` base units in domain; format with `Intl.NumberFormat('vi-VN')` at the edge | No float rounding in VND/token amounts |
| Cache | Redis with TTL per key family, `stale-at` metadata stored with the value | Honest staleness display |
| Rate limiting | Redis sliding window per IP on `/api/*` | Protect free RPC quotas |
| Tests | Vitest (core ≥ 90%, overall ≥ 80%), Playwright e2e + screenshots at 320/768/1024/1440 | Matches user rules |
| Deploy | Docker Compose on VPS behind Caddy + Cloudflare; GitHub Actions build → SSH deploy | Fits the existing VPS (check port/memory with quill & bo-stock) |
| Analytics | None in v1. If added later: self-hosted, cookieless, aggregate only, disclosed in privacy policy | PDPL (L5) |
| i18n | Vietnamese first (`lang="vi"`); English later via route prefix `/en` | Target market |

## 5. Data sources (to verify licence/ToS before use)

| Need | Candidate | Notes |
|---|---|---|
| Global prices | CoinGecko public API | Attribution required; respect rate limits |
| USD/VND | SBV central rate (sbv.gov.vn) | Label as the SBV rate; never OTC/USDT rates |
| EVM reads | Public RPC / Alchemy free tier | Keys server-side only, from env |
| Sanctions | OFAC SDN digital currency addresses | Public US data |
| Scam lists | Open-source phishing/scam address lists | Check licence; show the list name in the report |

Every adapter returns `{ data, source, fetchedAt }` so the UI can always attribute and timestamp.

## 6. Security

- Read-only by construction: no private-key code paths, no `eth_sendTransaction`, no wallet connect in v1.
- Strict CSP with a per-request nonce (`apps/web/src/proxy.ts`), so all pages render dynamically. Fonts are self-hosted by `next/font`, and there are no third-party scripts.
- No user-generated HTML. Addresses are validated (`isAddress`) before any RPC call.
- Secrets only in env and checked at startup with zod. `.env*` is git-ignored.
- Security headers: HSTS, nosniff, frame-ancestors none, strict referrer policy.

## 7. Compliance plumbing (enforced in code/CI)

- `LegalBar` component is rendered in the root layout, and an e2e test asserts it is present on every route.
- Policies have frontmatter `version`, `effectiveDate`, `updatedAt`. The footer shows the version, and `/thay-doi-chinh-sach` lists the history.
- CI test fails when `docs/LEGAL_REGISTER.md` `nextReviewDue` is in the past.
- Lint rule / test bans copy strings listed in DESIGN.md "Do not ship" (e.g. `UBCKNN`, `khuyến nghị mua`, `Institutional`).
- Every price component requires `source` and `fetchedAt` props (enforced by the type system).
