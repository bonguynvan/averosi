# Averosi — Architecture

**Averosi / averosi.com (working name; see `apps/web/src/lib/brand.ts`)**: a free, open-source, read-only Web3 data & risk terminal for Vietnamese users, aligned with Vietnam's digital-transformation direction. Legal constraints: [LEGAL_REGISTER.md](LEGAL_REGISTER.md). Design: [DESIGN.md](DESIGN.md).

## 1. Product scope

### v1 (free, no accounts)

| Module | Route | What it does | Data |
|---|---|---|---|
| Tổng quan ✅ | `/` | Landing (Binance/CMC-style, Vietnamese framing): hero with VND price board + sparklines, headline stats, neutral highlights (volume, absolute move, source deviation, never "top gainers"), tools bento, legal timeline, FAQ. | Market service + `content/phap-ly` |
| Biểu đồ ✅ | `/bieu-do?ma=` | Full-bleed tradecanvas `ChartWidget`: toolbar, indicators, drawings, chart types, settings, watchlist (fed from `/api/thi-truong`), alerts, replay, share-URL, layouts in localStorage. Read-only (`trading: false`, no depth ladder). Data via a `PollingAdapter` → `/api/nen` (1m/5m/15m/1h/1d, per-timeframe cache). Chrome themed via `--tcw-*` → tokens. | Exchange candles through our proxy |
| Thị trường ✅ | `/thi-truong`, `/tai-san/[symbol]` | Median reference price of the discovered universe (~300 assets listed against USD on ≥ 2 of Coinbase, Kraken, Bitstamp, Gemini; no stablecoins/fiat/gold tokens), VND at Vietcombank's USD transfer rate, 24h change, aggregated volume, source health and a ≠ mark when sources disagree > 3%. The server renders a 50-row table (search, sort and pages via URL params; never sorted by gains), which crawlers index. Once idle, the live grid (`bo-grid` custom element, lazy) replaces it in place: all assets, instant search, header sort (not on 24h change), neutral flashes on live prices, CSV export; secondary columns drop as the pane narrows. Detail page: `@tradecanvas/chart` candles via the same-origin proxy `/api/nen/[symbol]`. | Exchange public APIs + Vietcombank feed |
| Trung tâm rủi ro | `/rui-ro` | Paste an address or contract and get a risk report: sanctions list hit, known-scam lists, token approvals, contract flags (honeypot/proxy/owner mint). Shows the methodology. | Public RPC, OFAC SDN, open scam lists |
| Quyền token ✅ | `/quyen` | Full-history approval scan: one `eth_getLogs` filter (`Approval`, `ApprovalForAll`, Permit2 `Approval/Permit/Lockdown`, owner topic) via an archive RPC with adaptive windows (provider-limit hints, ceiling, honest "partial"). Current allowances re-read by multicall; only active ones shown, with spender risk. Revoke signed in the visitor's wallet (R12). | `ARCHIVE_RPC_URL_*` (keyed) + regular RPC |
| Theo dõi ví công khai ✅ | `/vi` | Watchlist (≤20, localStorage, private notes) refreshed every minute via `POST /api/vi`: native balance + VND reference, USDT/USDC amounts (multicall), outgoing tx count with "+N mới", OFAC/phishing flags. "Watch my wallet" from the connected wallet. | Public RPC (server), shared risk lists |
| Pháp lý ✅ | `/phap-ly`, `/phap-ly/[slug]` | Tracker of Vietnamese crypto law: status computed from effective dates (UTC+7), category filter via `?nhom=`, impacts, penalty tables, official sources, licensing status. | `content/phap-ly/*.md` (zod-validated) |
| Công cụ thuế | `/thue` | 0.1% transfer-tax calculator (client-side, nothing stored). | Pure function |
| Kiến thức ✅ | `/kien-thuc`, `/kien-thuc/[slug]` | Education: self-custody, scam patterns (address poisoning, permit phishing, EIP-7702 drainers), pilot market, 0.1% tax, reading indicators, token approvals. Topic filter `?chu-de=`; articles link only to our own tools. | `content/kien-thuc/*.md` (zod-validated) |
| Policies | `/mien-tru-trach-nhiem`, `/dieu-khoan`, `/quyen-rieng-tu` | Versioned legal pages. | `content/policies/` |

### Product pillars (owner direction, 2026-10-01)

All three pillars can live inside the product **when their conditions hold**. Each new feature still goes through the legal gate in CLAUDE.md §1.

| Pillar | Examples | Allowed when | Never |
|---|---|---|---|
| Data & bot tracker | on-chain event feed, public-wallet watch, alerts by web push or email | facts only, sourced and timestamped; no trading calls; alerts opt-in; personal data (email/push token) only after a policy update | buy/sell signals, copy-trade, Telegram bots for VN users, labelling private individuals |
| Client-side utilities | approval revoker, tx decoder, offline tx builder, address-poisoning checker | runs fully in the browser; user's own wallet signs; we never see keys; no fee taken on transactions | custody, relaying signed txs on users' behalf, swaps/bridges, fee-per-transaction |
| Developer tooling | risk-screening library/API, SIWE helpers, webhook dispatcher, Vietnamese tax/VND formatting libs | open source; free tier first; selling to licensed VASPs/businesses only after business registration | anything that makes us operate a trading/custody service |

### Later (each needs a LEGAL_REGISTER review first)

- "Sự kiện dữ liệu" feed: factual on-chain/volume anomalies, no verdicts.
- Data from licensed VN exchanges once they publish public market-data APIs. These would replace global prices as the primary VND source.
- B2B: an open-source AML/risk-screening library for licensed VASPs (the risk-center engine, extracted).
- Non-financial blockchain verification (certificates, document hashes) for digital transformation.

### Never

Custody, signing, swaps, order routing, on/off-ramp, OTC/P2P rates, token issuance, referral links, trading signals, Telegram bots. See LEGAL_REGISTER R1–R12.

## 2. System overview

```
 Exchanges: catalogs + bulk tickers (REST)        Exchanges: candles (REST) + tickers (WebSocket)     Vietcombank FX
        │                                                         │                                       │
        ▼                                                         ▼                                       │
 ┌──── apps/worker (TypeScript) ─────────────────┐   ┌──── services/ingestor (Go) ───────────────────┐   │
 │ universe daily → assets table                 │   │ WS tickers (all assets) → median → market:live│   │
 │ overview 15s → market:overview, market:rank ◄─┼───┼─ reads market:rank + market:demand → hot set  │   │
 │ indicators: drains ta:dirty → ta:{sym}:{tf}  ◄─┼───┼─ candles (rate-limited) → Postgres, ta:dirty  │   │
 │ retention daily                               │   └────────────────────────────────────────────────┘   │
 └───────────────────────────────────────────────┘◄──────────────────────────────────────────────────────┘
                 Postgres (assets, candles, asset_quotes, fx_rates) · Redis (overview, rank, demand, ta:*, market:live)
                                                        │
 ┌──────────────────────────────────────────────────────▼─────────────────────────┐
 │ apps/web (Next.js) — MARKET_BACKEND=store: read-only view of the store          │
 │  (only write: market:demand = symbol + time when a chart is requested)          │
 │  pages (RSC) · /api/nen · /api/phan-tich · /api/thi-truong · /api/truc-tiep SSE │
 └─────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ same-origin only (R11)
                                    Browser
```

- **Backends:** `MARKET_BACKEND=direct` (default for dev) makes the web process call exchanges itself with in-process caches (universe from the catalogs, cached 6h), and "live" means the overview polled every 15s. `MARKET_BACKEND=store` (production) only reads what the worker and ingestor write. `DATA_MODE=fixture` (e2e) uses the direct backend with the seed list and deterministic data.
- **Universe:** the worker reads the four exchanges' public USD catalogs once a day and keeps assets listed on ≥ 2 of them, minus stablecoins, fiat and gold tokens (`buildUniverse` in `@app/core`, R11). About 300 assets; prices are nano-units (1e-9 USD); the overview hides those below $0.000001 (precision floor) or with sources > 20% apart (`aggregateQuotes`). A catalog outage never deactivates assets.
- **Worker** (`apps/worker`, TypeScript): universe (daily), overview (15s, one bulk request per exchange, plus the by-volume rank for the ingestor), indicators (every 10s for series the ingestor marked dirty, pure TA from `@app/core`), retention (daily: 1m 7d, 5m 30d, 15m 90d, 1h 2y, quotes 180d, 1d kept).
- **Ingestor** (`services/ingestor`, Go, ~15 MB RAM): Coinbase `ticker_batch` + Kraken v2 `ticker` WebSockets for the whole universe → median of fresh ticks → `market:live` once per second. Candles via REST with per-exchange token buckets (Coinbase → Kraken → Bitstamp fallback): **hot** assets (top 40 by volume + anything viewed in the last 10 min) get all timeframes (1m every 30s … 1d every 30 min), the rest 1h hourly and 1d every 6h. Only changed buckets are written. `GET :8090/healthz` reports feeds and sync counts. Key names are shared with `packages/store/src/cache.ts` (keep in sync).
- **Web realtime:** one Redis subscription per web process (`liveHub`) is fanned out to SSE clients (`/api/truc-tiep`, heartbeat 20s, ≤4 streams per client). The browser converts USD to VND with the page's Vietcombank rate.
- **Technical analysis** lives in `@app/core` (pure functions) and is computed server-side (worker, or on demand in direct mode), never in the browser. Values only, no signals (R4).
- **No personal data** is stored anywhere: the store holds market data only.

## 3. Repository layout

pnpm workspace. Same layering as quill-v2: domain → application → infrastructure.

```
averosi-v2/
├── CLAUDE.md
├── design/tokens.css                 # source of truth for colours/type/spacing
├── docs/                             # ARCHITECTURE, DESIGN, LEGAL_REGISTER, ADRs
├── content/
│   ├── policies/                     # disclaimer / terms / privacy (versioned MD)
│   ├── phap-ly/                      # one MD file per legal instrument (frontmatter, zod-validated)
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
│   └── worker/                       # TS worker: universe, overview, indicators, retention
├── services/ingestor/                # Go: realtime tickers + candles for the whole universe
├── packages/market-data/             # exchange catalogs/quotes/FX/candle adapters (server-only)
├── packages/store/                   # Postgres (migrations, repos) + Redis (cache, pub/sub)
├── tools/legal-watch/                # weekly Perplexity legal scan → GitHub issue
├── test/e2e/                         # Playwright
└── docker/                           # compose, Caddyfile
```

## 4. Key technical decisions

| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript strict, ESM; Go for `services/ingestor` | TS end to end for product code; Go where hundreds of concurrent streams/requests must stay cheap on a small VPS |
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
| Charts | `@tradecanvas/chart` (owner's MIT library, from npm, not a local link) for Thị trường / Chi tiết tài sản | Canvas, zero runtime deps, built for trading charts |
| i18n | Vietnamese first (`lang="vi"`); English later via route prefix `/en` | Target market |

## 5. Data sources (to verify licence/ToS before use)

| Need | Candidate | Notes |
|---|---|---|
| Spot prices | Coinbase, Kraken, Bitstamp, Gemini public APIs (USD fiat pairs) | Median of ≥1 sources; 1-source rows flagged; exchange names never linked (R11) |
| USD/VND | Vietcombank public XML (USD transfer) | SBV site blocks bots; swap via `FxSource` when an official feed exists; never OTC/USDT rates |
| Candles | Coinbase, Kraken fallback | Served through `/api/nen` so browsers never contact exchanges |
| EVM reads | Public RPC / Alchemy free tier | Keys server-side only, from env |
| Sanctions | OFAC SDN digital currency addresses | Public US data |
| Scam lists | Open-source phishing/scam address lists | Check licence; show the list name in the report |

Every adapter returns `{ data, source, fetchedAt }` so the UI can always attribute and timestamp.

## 6. Security

- Per-client limits (risk checks, candle API, live streams) key on `cf-connecting-ip` / `x-forwarded-for`. **The reverse proxy must set these headers.** Without them, all visitors share one key: rate limits become global, and live streams fall back to a global cap of 500.


- Read-only by construction: no private-key code paths and no transaction relaying. Wallet connection (wagmi, injected connector, EIP-6963 discovery) only reads the visitor's address and network. Browser RPC goes through the visitor's wallet (`unstable_connector`). Signing is limited by R12.
- Strict CSP with a per-request nonce (`apps/web/src/proxy.ts`), so all pages render dynamically. Fonts are self-hosted by `next/font`, and there are no third-party scripts.
- No user-generated HTML. Addresses are validated (`isAddress`) before any RPC call.
- Secrets only in env and checked at startup with zod. `.env*` is git-ignored.
- Security headers: HSTS, nosniff, frame-ancestors none, strict referrer policy.

## 7. Compliance plumbing (enforced in code/CI)

- Weekly `Legal watch` workflow (`tools/legal-watch`): Perplexity Agent API scan of the review window on trusted domains, then a GitHub issue for human verification. It never writes content.

- `LegalBar` component is rendered in the root layout, and an e2e test asserts it is present on every route.
- Policies have frontmatter `version`, `effectiveDate`, `updatedAt`. The footer shows the version, and `/thay-doi-chinh-sach` lists the history.
- CI test fails when `docs/LEGAL_REGISTER.md` `nextReviewDue` is in the past.
- Lint rule / test bans copy strings listed in DESIGN.md "Do not ship" (e.g. `UBCKNN`, `khuyến nghị mua`, `Institutional`).
- Every price component requires `source` and `fetchedAt` props (enforced by the type system).
