---
reviewedAt: 2026-10-01
nextReviewDue: 2026-10-31
reviewer: owner (non-lawyer) — chưa được luật sư thẩm định
---

# Legal Register — Averosi

Automation: `tools/legal-watch` scans weekly (Perplexity Agent API) and opens a `legal-watch` issue with leads. Every lead must be verified against the original document before this register or `content/phap-ly` changes. The daily CI still fails when `nextReviewDue` has passed.

Snapshot of Vietnamese law that constrains this product. **Update this file before building any feature that touches money, trading, user data, or advertising**, and at least every 30 days (`nextReviewDue`; CI fails when it is past). Not legal advice.

## Status of the owner

Individual, **no business registration**, product is **free** (no revenue, no ads, no affiliate). Revisit this whole register before charging money, running ads, or collecting accounts.

## Laws in force

| # | Instrument | Effective | What it means for Averosi |
|---|---|---|---|
| L1 | Luật Công nghiệp công nghệ số (QH15, 14/06/2025) | 01/01/2026 | Digital/crypto assets are recognised as property. Recognition ≠ permission to provide services. |
| L2 | Nghị quyết 05/2025/NQ-CP — thí điểm thị trường tài sản mã hóa | 09/09/2025, 5 năm | Only licensed providers (vốn ≥ 10.000 tỷ) may run trading/custody/issuance. Trading & settlement in VND. **Only licensed providers may advertise crypto assets.** Domestic investors must trade via licensed providers. Securities and digital fiat excluded from "tài sản mã hóa". |
| L3 | Nghị định 284/2026/NĐ-CP — xử phạt VPHC lĩnh vực tài sản mã hóa | 01/09/2026 | Unlicensed crypto services: tổ chức 180–200tr, cá nhân 90–100tr + tịch thu, buộc gỡ nền tảng. Unlicensed advertising: same band. Domestic investor trading outside licensed providers: 30–50tr. Illegal collection/disclosure of account data: 150–200tr (tổ chức). |
| L4 | Thông tư 32 (BTC) — thuế giao dịch tài sản mã hóa | 27/03/2026 | 0,1% PIT per transfer, withheld by licensed VASP. Luật Thuế TNCN sửa đổi (hiệu lực 01/07/2026) adds crypto transfer income. Basis for the free tax calculator. |
| L5 | Luật Bảo vệ dữ liệu cá nhân 2025 + Nghị định 356/2025/NĐ-CP | 01/01/2026 | Consent, purpose limitation, data-subject rights. Replaces NĐ 13/2023. v1 collects no personal data by design. |
| L6 | Crypto is not legal tender (Luật NHNN, NĐ 88/2019 sửa đổi) | — | Never accept or facilitate crypto payment. |
| L7 | Telegram blocked by MIC order | since 05/2025 | No Telegram dependency for VN users. |

## Licensed ecosystem (as of 2026-10-01)

MoF accepted 5/7 exchange dossiers (03/2026): VIX (VIXEX), Lộc Phát (LPEX), Việt Nam Thịnh Vượng (CAEX), Techcom (TCEX), CTCP Tài sản số Việt Nam. Rejected: Dolphinex, SSI Digital. As reported after NĐ 284 took effect (09/2026), **no exchange has yet been licensed**: the five dossiers are "hợp lệ" but not licensed. Do not label any of them "được cấp phép" until an official MoF announcement says so.

## Product rules derived from the above

| Rule | Source |
|---|---|
| R1 Read-only. Never hold keys, funds, or sign transactions for users. | L2, L3 |
| R2 No order routing, swap, bridge, on/off-ramp, P2P matching, OTC quotes. | L2, L3 |
| R3 No promotion of crypto assets or unlicensed platforms: no referral links, no "mua ngay", no token shilling. Neutral links to official MoF announcements are OK. | L2, L3 |
| R4 No investment advice: present facts and methodology, never buy/sell/hold verdicts or leverage suggestions. | L2 (spirit), consumer protection |
| R5 No derivatives content presented as actionable. | L2 scope |
| R6 Collect no personal data in v1 (no accounts, no email, no tracking cookies). Watchlists live in the browser. | L5 |
| R7 Do not attach real-person identities to wallet addresses. Labels only for public entities with a cited public source (exchange hot wallets, sanctioned addresses). | L5, L3 (data) |
| R8 Every page shows the disclaimer bar; every price shows source + timestamp + "tham khảo". | R3, R4 |
| R12 Wallet connection (owner decision 2026-10-01): connecting an injected wallet (EIP-6963) is allowed **to read the visitor's own address and network only**. Signing is allowed only for visitor-initiated, fee-free actions on their own assets that run entirely in the browser (e.g. revoking token approvals). Never request seed phrases, never move funds, swap, bridge or relay transactions, never take a fee. The UI must state this next to every connect button. | R1, R2, R3 |
| R11 Until a licensed VN exchange publishes market data, prices come from foreign exchanges' public **USD fiat** pairs (never USDT), aggregated by median. Exchange names appear only as data attribution: no links, logos, referral or "where to buy". The visitor's browser never contacts an exchange. | R3, owner decision 2026-10-01 |
| R9 No Telegram/Zalo bots that relay trading signals. | L7, R4 |
| R10 Do not issue tokens/NFTs or run airdrops. | L2, L3 |

## Third-party data used in production

| Data | Source | Licence | Notes |
|---|---|---|---|
| OFAC SDN digital-currency addresses (ETH list, applied to all EVM chains) | github.com/0xB10C/ofac-sanctioned-digital-currency-addresses | MIT (extraction of public US-government data) | Delistings (e.g. Tornado Cash, 03/2025) disappear from the list automatically |
| Phishing addresses | github.com/scamsniffer/scam-database | GPL-3.0 | Fetched at runtime, not vendored; 7-day delay; attributed on /rui-ro |
| EVM state (code, nonce, balance, storage slots) | PublicNode RPC (default, overridable) | Public endpoints | Provider sees queried address, not user IP |
| Spot prices, 24h change/volume (USD pairs) | Coinbase Exchange, Kraken, Bitstamp, Gemini public market-data APIs | Public, unauthenticated | Server-side only, cached 60s; candles from Coinbase (Kraken fallback), cached 5 min |
| USD/VND rate | Vietcombank public XML feed ("for reference only, 1 request / 5 min") | Public | Cached 30 min. SBV central-rate site rejects automated access (WAF), so it is not scraped |

## Open questions (ask a fintech lawyer before acting)

- Does publishing VND-denominated reference prices (from foreign exchanges, while no VN exchange is licensed) count as "quảng cáo tài sản mã hóa"? Current mitigations: R8, R11, no ranking by gains, no calls to action.
- Does a free wallet-risk checker count as "dịch vụ liên quan đến tài sản mã hóa" under NĐ 284?
- Obligations when moving from free → paid (hộ kinh doanh vs công ty; e-invoice).

## Sources

- NQ 05/2025 toàn văn — https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm
- NĐ 284/2026 — https://luatvietnam.vn/tin-van-ban-moi/tu-01-9-2026-cung-cap-dich-vu-tai-san-ma-hoa-chua-duoc-cap-phep-bi-phat-den-200-trieu-dong-186-110675-article.html
- NĐ 284/2026 (nhà đầu tư) — https://vneconomy.vn/phat-den-50-trieu-dong-voi-ca-nhan-giao-dich-tai-san-ma-hoa-khong-qua-don-vi-duoc-cap-phep.htm
- NĐ 284/2026 (VTV) — https://vtv.vn/phat-toi-200-trieu-dong-neu-cung-cap-dich-vu-tai-san-ma-hoa-trai-phep-10026071722541343.htm
- Thuế 0,1% — https://vtv.vn/ap-thue-01-gia-chuyen-nhuong-tai-san-ma-hoa-100260331100140124.htm
- Hồ sơ sàn — https://vietstock.vn/2026/03/bo-tai-chinh-duyet-57-ho-so-san-tai-san-ma-hoa-loai-2-ho-so-16312-1413953.htm
- Luật CN công nghệ số — https://mst.gov.vn/nhung-chinh-sach-cong-nghe-tac-dong-toi-nguoi-dan-nam-2026-197260219125425961.htm
- NĐ 356/2025 — https://luatvietnam.vn/tin-van-ban-moi/da-co-nghi-dinh-356-huong-dan-luat-bao-ve-du-lieu-ca-nhan-2025-186-106267-article.html
- Telegram — https://vnexpress.net/nha-mang-phai-chan-telegram-tai-viet-nam-4889659.html

## Change log

- 2026-10-01 — Initial register.
- 2026-10-01 — Public-wallet watch (/vi) and read-only wallet connection (wagmi, injected/EIP-6963) added under new rule R12. Stablecoin balances are shown as amounts only (no USDT→VND conversion, R2). Privacy policy v0.5.0.
- 2026-10-01 — Public legal tracker (/phap-ly) launched from `content/phap-ly`. Instrument numbers verified: Luật 71/2025/QH15, Luật 91/2025/QH15, Luật 109/2025/QH15, NQ 05/2025/NQ-CP, NĐ 356/2025/NĐ-CP, NĐ 284/2026/NĐ-CP, TT 32/2026/TT-BTC (VAT-exempt, 20% CIT for organisations). Landing page added. Highlights avoid "top gainers".
- 2026-10-01 — Market module: owner approved using major foreign exchanges' public data while no VN exchange is licensed (no revenue, no transactions). Added R11. FX switched from SBV central rate (not machine-accessible) to Vietcombank's published rate, disclosed on every market view.
- 2026-10-01 — Re-checked before building /rui-ro: no new instrument; no exchange licensed yet; added third-party data table. Commentary on NĐ 284 (LuatVietnam) treats informational/analytical content as distinct from service provision. Open question about the risk checker remains.
