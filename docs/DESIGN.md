# Averosi Design System

Tokens: [`design/tokens.css`](../design/tokens.css). Visual reference: `stitch_averosi_vietnam_crypto_terminal/` (kept locally, git-ignored because its mock copy must not be published) (Bloomberg-amber terminal, the "Aegis Quant" spec).

## Direction

Industrial terminal / brutalist: pure black canvas, 1px hairline panes, amber phosphor accent, monospaced numbers, zero radius, no blurred shadows. Dark only — the terminal metaphor is the product identity (deliberate choice, not a default). Density is high on desktop, single-pane tabbed on mobile.

## How Stitch conflicts were resolved

The four Stitch screens and `DESIGN.md` disagree. Decisions:

| Token | Stitch variants | Chosen | Why |
|---|---|---|---|
| Accent | `#ff9900`, `#ffc082` used as `primary` | `#ff9900` = accent, `#ffc082` = accent-soft (text) | Overview + asset screens use `#ff9900`; soft variant kept for long amber text |
| Up / green | `#02e600`, `#00ff66`, `#77ff61` | `#02e600` | DESIGN.md + logo screen; one green only |
| Down / red | `#ff3b30`, `#93000a`, `#ffbcb5` | `#ff3b30` (+ `#450a0a` container) | `#93000a` fails contrast as text on black |
| `secondary` | amber in overview, green elsewhere | dropped — use semantic `up/success` | Ambiguous name caused the drift |
| Radius | `0` (DESIGN.md) vs `0.125rem` (screens) | `0` | Spec is explicit; 2px is invisible noise |
| Prose font | Inter (DESIGN.md) vs mono everywhere (screens) | Inter for paragraphs | Long Vietnamese text with diacritics reads poorly in mono |
| Logo | remote `lh3.googleusercontent.com` image | inline SVG from `averosi_terminal_bloomberg_amber_logo/code.html` | No third-party image hosts |

Market colour convention follows Vietnamese stock apps: **xanh = tăng, đỏ = giảm, vàng = tham chiếu**. Never encode direction by colour alone — always pair with `▲ ▼` or a sign.

## Copy rules (legal — overrides Stitch text)

Stitch mock copy contains claims we must **not** ship:

| Do not ship | Reason | Use instead |
|---|---|---|
| "Thông tư UBCKNN giám sát", "Tuân thủ thông tư bảo vệ NĐT" | Implies state supervision/licence we don't have | "Dự án mã nguồn mở, không được cấp phép và không chịu giám sát bởi cơ quan nhà nước" |
| "Institutional", "Inst. Member #VN-0941", "Research Desk" | Fabricated status | Nothing — no accounts in v1 |
| "Averosi khuyến nghị…", "rà soát đòn bẩy", "Tích cực/Tiêu cực" verdicts | Investment advice | Factual data: "Khối lượng tăng 240% so với TB 7 ngày" |
| Phái sinh (funding, long/short, Long Squeeze) | Derivatives are not part of the VN pilot market | Omit |
| "Tỷ giá USDT/VND OTC", "Thanh khoản stablecoin nội địa" | Normalises unlicensed P2P trading | Omit |
| "Tín hiệu thị trường" (signals) | Reads as trading calls | "Sự kiện dữ liệu" (data events) |
| Buttons "Mua/Bán", "Giao dịch ngay", any exchange referral link | Advertising crypto services needs a licence | No action buttons that lead to trading |

Every page shows the persistent legal bar (`--legal-bar-h`) linking to `/mien-tru-trach-nhiem`. Prices always carry "Giá tham khảo · nguồn · thời điểm".

## Motion & scrolling

- Animate only `transform` and `opacity`. Layout changes (sidebar collapse, panel toggle) use the **View Transitions API** via `runViewTransition()` (`apps/web/src/lib/viewTransition.ts`). Snapshots are clipped, not scaled (`object-fit: none`), so text never squashes. Browsers without the API change state instantly.
- Durations: `--ds-duration-fast` 120ms (hover/colour), `--ds-duration-normal` 200ms (fades), `--ds-duration-slow` 280ms (enter, view transitions). Easing `--ds-ease-out`. All of them become 0 under `prefers-reduced-motion`, and view-transition animations are disabled there too.
- Page content eases in via `app/template.tsx` (`animate-enter`). Data waits show `PageSkeleton` inside `<Suspense>` placed **after** `notFound()` checks. Never use a root `loading.tsx`, because it makes 404s return 200.
- Sticky shell: the header, legal bar and mobile nav sit in `#shell-top`. `ShellMetrics` publishes its height as `--ds-shell-top`, which the sidebar, table headers and `scroll-padding-top` use.
- Scrollers: thin token-coloured scrollbars; horizontal scrollers use `scroll-fade-x` (snap + edge mask) and scroll only themselves.
- Collapsible panels (`CollapsiblePanel`) are for methodology and sources only. Legal notices are never collapsible.

## Accessibility

- `--color-text-faint` (#737373) is ~4.4:1 on black — metadata only, never body text.
- Focus: 1px amber outline (`--focus-ring`), never removed.
- Respect `prefers-reduced-motion` (LED pulse and ticker stop).
- Test at 320 / 768 / 1024 / 1440.
