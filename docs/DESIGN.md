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

Libraries: **GSAP** (+ `@gsap/react` `useGSAP`, ScrollTrigger) for animation, and **Lenis** for smooth scrolling, sharing GSAP's ticker. Both are wired in `apps/web/src/lib/motion/gsap.ts` and `components/motion/*`.

| Concern | How |
|---|---|
| Page scroll | Lenis (`SmoothScroll`, lerp 0.12). Inner scrollers opt out with `data-lenis-prevent` (sidebar) or `data-lenis-prevent-wheel` (horizontal timeline). No CSS `scroll-behavior`. |
| First paint | CSS keyframe `animate-enter` (template). Never animate above-the-fold content from JS: it would flash after hydration. |
| Scroll reveals | Add `data-reveal` to a block. `ScrollReveal` hides only blocks that start below the fold, then batches them in (opacity + y). |
| Sidebar | GSAP width tween; labels (`data-nav-label`) fade out first and in last. The inner nav is always 256px and the column clips (`overflow-x: clip`, not `hidden`, so sticky still works), so icons never move. |
| Panels / FAQ | `CollapsiblePanel`, `AnimatedDetails`: GSAP height tween to/from `auto` plus fade; `hidden`/`open` set at the right moment for assistive tech. |
| Lists | Stagger on state change only (e.g. price-board tabs), never on first render. |

Rules:
- Every GSAP effect runs inside `gsap.matchMedia("(prefers-reduced-motion: no-preference)")` or checks `prefersReducedMotion()`. With reduced motion, state changes are instant and Lenis is off.
- Use `useGSAP` / `contextSafe` (automatic cleanup), not raw `useEffect` tweens.
- Tokens: JS durations live in `MOTION` and mirror the `--ds-duration-*` tokens.
- Content must be fully visible without JS.
- Collapsible panels are for methodology and sources only. Legal notices are never collapsible.
- The sticky shell (`#shell-top`, `--ds-shell-top` from `ShellMetrics`) and thin token scrollbars are unchanged.
- Never use a root `loading.tsx`: wrap slow data in `<Suspense>` after `notFound()` checks.

## Performance budget

Measured compressed JS per page: `/`, `/thi-truong`, `/vi` about 230 KB (budget 300 KB). `/bieu-do` about 350 KB is an accepted exception: it is the full chart terminal, and the tradecanvas widget loads lazily there. Client-side modules avoid zod and other server-oriented libraries (see `lib/wallet/watchlist.ts`).

## Accessibility

- `--color-text-faint` (#737373) is ~4.4:1 on black — metadata only, never body text.
- Focus: 1px amber outline (`--focus-ring`), never removed.
- Respect `prefers-reduced-motion` (LED pulse and ticker stop).
- Test at 320 / 768 / 1024 / 1440.
