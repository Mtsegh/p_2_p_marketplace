# DESIGN_RULES.md

UI/UX rules for the P2P marketplace. Written for AI coding agents and human developers.
App: users list items and either sell them or exchange them, with an escrow-backed "Safe Handoff" (buyer inspects the item, shows a one-time code or QR, seller enters it, funds release). Trust is the product.
Stack: Next.js (TypeScript, App Router assumed) + Tailwind CSS v4. Mood: technical and minimal. Devices: phones and desktop equally.
Where it lives: `client/DESIGN_RULES.md` (the client is deployed independently, so keep it inside `client/`). Reference it from `AGENTS.md`.
Last verified against current sources: 2026-11-17.

---

## 0. How to use this file

**For AI agents:** read this file before generating or changing any UI. Follow it over your default style habits.

- `MUST` / `NEVER` are hard rules. Do not break them without asking.
- `SHOULD` / `AVOID` are strong defaults. Break them only with a stated reason.
- Each rule has a tag showing how trustworthy it is:
  - `[STD]` an accessibility or web standard (WCAG 2.2, HTML, CSS specs).
  - `[SUPPORT]` a browser-support fact. Statuses are in section 11.
  - `[RESEARCH]` backed by published UX research.
  - `[HEURISTIC]` a design convention. Good default, not a law. Do not cite it as a requirement.
- If a needed token, font, or brand value is missing, use the defaults here and list what you assumed in your reply.
- Never add visual effects that are not in this file. When unsure, choose the plainer option.
- Before finishing UI work, run the checklist in section 13.

**For developers:** the code blocks are meant to be copied. Sections 5 and 6 are the foundation. Sections 7 and 8 are marketplace-specific.

### Open decisions (fill in; defaults shown)

| Decision | Default used in this file |
|---|---|
| Brand name / logo | none (do not invent one) |
| Brand hue (OKLCH hue angle 0-360) | `255` (cool blue). Change `--hue` in section 5 |
| Currency and locale | take both from data; format with `Intl.NumberFormat` |
| Dark mode | supported, follows system, user can override |
| Right-to-left languages | not required, but use logical properties anyway |
| Supported browsers | Baseline Widely available, plus the enhancements in section 11 with fallbacks |
| Payment gateway | Undecided (Stripe, Razorpay, Paystack or Flutterwave). UI must not depend on the provider; never restyle or wrap gateway-hosted fields |
| Platform fee, escrow window, refund and dispute rules | Undecided. Read from settings or the API; never hardcode amounts or day counts in UI copy |
| Network and device assumptions | Treat as mid-range phones on variable networks (section 12) until usage data says otherwise |

---

## 1. Hard rules (read these first)

1. `MUST` one primary action per view or section. It is the only element using the solid accent fill. `[HEURISTIC]`
2. `MUST` body text contrast of at least 4.5:1; large text and UI components (borders, icons, focus rings) at least 3:1. `[STD]` WCAG 1.4.3, 1.4.11
3. `MUST` every interactive target at least 24x24 CSS px, and at least 44x44 px on touch (`pointer-coarse`). `[STD]` WCAG 2.5.8 (AA minimum), 2.5.5 (AAA 44px)
4. `MUST` a visible `:focus-visible` indicator with 3:1 contrast. Never `outline: none` without a replacement. `[STD]` WCAG 2.4.7, 1.4.11
5. `MUST` use native elements first: `<button>`, `<a>`, `<dialog>`, `<details>`, `[popover]`, `<label>`. `[STD]`
6. `MUST` respect `prefers-reduced-motion`. `[STD]` WCAG 2.3.3 (AAA, but treat as required)
7. `MUST` mobile-first. Base styles are the phone layout; add `sm:` and up for larger screens. `[HEURISTIC]`
8. `MUST` reserve space for images, avatars and async content (aspect ratio or fixed size) so layout never jumps. `[RESEARCH]` Core Web Vitals
9. `MUST` keep body line length at 50-75 characters (`max-w-prose`-style, about `65ch`). `[RESEARCH]` Baymard, Bringhurst
10. `MUST` size fluid text with `rem` bounds and test at 200% zoom. `[STD]` WCAG 1.4.4
11. `NEVER` hide required actions behind `:hover`. Touch devices have no hover. `[STD]`
12. `NEVER` use fake social proof, fake urgency, fake scarcity, or decorative "verified" badges. A marketplace runs on trust. `[HEURISTIC]`
13. `NEVER` use `100vh` for full-height sections. Use `svh` (or `min-h-svh`). `[SUPPORT]`
14. `NEVER` convey meaning by color alone. Pair color with text or an icon. `[STD]` WCAG 1.4.1
15. `AVOID` anything in the anti-pattern list (section 10).

---

## 2. Psychology: laws turned into rules

| Law | What it says | Rule for this app |
|---|---|---|
| Hick's Law `[RESEARCH]` | Decision time grows with the number and complexity of choices | One primary CTA per screen. Hide secondary filters and actions behind "More". Do not show 12 equal buttons. |
| Fitts's Law `[RESEARCH]` | Bigger, closer targets are faster to hit | Primary actions are large and in thumb reach on mobile (sticky bottom bar). Target sizes per hard rule 3. |
| Jakob's Law `[RESEARCH]` | People expect your product to work like others they know | Logo top-left, search prominent, "Sell" / "My deals" / profile top-right (desktop) or a bottom tab bar (mobile). Be original in visual style, conventional in behavior. |
| Law of Proximity `[RESEARCH]` | Near things are read as related | Group with spacing, not boxes. Related fields 8-12px apart, separate groups 24-40px apart. |
| Aesthetic-usability effect `[RESEARCH]` | Good-looking interfaces are judged easier to use | Consistency beats decoration. Same spacing scale, one button style per level, one radius. |
| Doherty threshold `[RESEARCH]` | Feedback within about 400ms keeps attention | Any action slower than 400ms shows visible feedback (pressed state, spinner, skeleton). |
| Tesler's Law `[RESEARCH]` | Complexity cannot be removed, only moved | Put complexity (fees, escrow, disputes) on the system side. Show the user a clear summary and a "details" disclosure. |

**Trust is the core UX problem of a peer-to-peer marketplace.** Strangers trade with strangers. Design every screen so the user can answer: Who is this seller? Is my money safe? What happens if it goes wrong? `[HEURISTIC]`

---

## 3. Visual hierarchy

Hierarchy answers "what do I look at first, second, third?". Build it from contrast, not decoration.

- `MUST` establish order with **size, weight, color contrast and spacing**, in that order. Not with shadows, gradients or animation.
- `SHOULD` use a limited type scale. Do not invent sizes outside it. `[HEURISTIC]`

| Role | Tailwind | Size |
|---|---|---|
| Caption, meta | `text-sm` | 14px |
| Body (default) | `text-base` | 16px |
| Lead, card title | `text-lg` | 18px |
| Section heading | `text-xl` / `text-2xl` | 20 / 24px |
| Page heading | `text-3xl` | 30px |
| Hero / display (rare) | `text-display` (section 4) | fluid 32-56px |

- `SHOULD` price is the most prominent element on a listing card, then the title, then meta. `[HEURISTIC]`
- `SHOULD` the accent color appears on at most one solid element plus links and focus rings per view. `[HEURISTIC]`
- `SHOULD` use the squint test: blur the screen mentally. The primary action and the main content must still stand out. `[HEURISTIC]`
- `SHOULD` expect F-pattern scanning on text-heavy and list pages, so left-align text and put key info at the start of each line. `[RESEARCH]`

---

## 4. Typography

Technical and minimal: one sans family for UI, one mono family for numbers, IDs and codes.

- `MUST` body text 16px or larger. Form inputs use `text-base` at minimum (smaller sizes make iOS Safari zoom the page on focus). `[HEURISTIC]`
- `MUST` body line height 1.5-1.7 (`leading-normal`/`leading-relaxed`); headings 1.1-1.3. `[RESEARCH]`
- `SHOULD` use `text-balance` on headings and `text-pretty` on paragraphs. `balance` only affects short blocks (about 6 lines in Chromium, 10 in Firefox). `pretty` has narrower browser support and a layout cost, so treat it as optional polish. `[SUPPORT]`
- `SHOULD` use `font-mono tabular-nums` for prices, quantities, order IDs and timestamps so digits align. `[HEURISTIC]`
- `AVOID` more than two font families and more than three weights (400, 500, 600). `[HEURISTIC]`
- `NEVER` use ALL CAPS for sentences. Small tracked uppercase labels (up to about 3 words) are fine.

**Fonts in Next.js** (self-hosted by `next/font`, no layout shift):

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
```

**Fluid display size** (only for hero headings). Body and UI text stay fixed in `rem`.

```css
@theme inline {
  --text-display: clamp(2rem, 1.4rem + 2.4vw, 3.5rem);
  --text-display--line-height: 1.1;
}
```

Rules for any `clamp()` font size `[STD]` WCAG 1.4.4:
1. Min and max are in `rem`, never `px`.
2. Keep the `vw` coefficient small.
3. Keep `max <= 2.5 x min`. (Derived from the 200%-text-at-500%-zoom requirement; it is a rule of thumb, not a guarantee.)
4. Always test by zooming to 200%.
5. Never fluid-scale body text.

---

## 5. Color

### Rules

- `MUST` define colors as semantic tokens (canvas, surface, ink...), not raw values in components. `[HEURISTIC]`
- `MUST` build the palette in OKLCH. Equal lightness steps look equal across hues. `[SUPPORT]`
- `MUST` measure contrast after any color change. OKLCH lightness is a guide, not a WCAG guarantee. `[STD]`
- `SHOULD` use tinted neutrals (a trace of brand hue, chroma 0.004-0.02), never pure gray. `[HEURISTIC]`
- `SHOULD` use one accent hue plus semantic danger/success/warning. `[HEURISTIC]`
- `SHOULD` follow roughly 60-30-10: about 60% canvas, 30% surfaces and text, 10% accent. `[HEURISTIC]`
- `SHOULD` keep chroma inside the sRGB gamut so colors look the same on every screen. The values below are in gamut.
- `NEVER` use purple-to-blue gradients, glow, or neon as the brand look.
- Color meaning: blue = trust/neutral action, green = success/available, red = error/destructive, amber = caution. Always pair with text or an icon.

### Token values

Contrast ratios below were computed with the WCAG relative-luminance formula for hue 255. Re-check if you change `--hue` or any value.

| Token | Light | Dark | Use | Light contrast | Dark contrast |
|---|---|---|---|---|---|
| `canvas` | `oklch(98.5% 0.004 H)` | `oklch(17% 0.012 H)` | Page background | | |
| `surface` | `oklch(100% 0 0)` | `oklch(21% 0.014 H)` | Cards, sheets | | |
| `ink` | `oklch(22% 0.02 H)` | `oklch(94% 0.01 H)` | Body text | 16.6:1 | 16.0:1 |
| `muted` | `oklch(48% 0.02 H)` | `oklch(72% 0.015 H)` | Secondary text | 6.3:1 | 7.7:1 |
| `line` | `oklch(62% 0.02 H)` | `oklch(56% 0.02 H)` | Input borders, icons (UI, needs 3:1) | 3.5:1 | 4.1:1 |
| `hairline` | `oklch(92% 0.006 H)` | `oklch(28% 0.012 H)` | Decorative dividers only | n/a | n/a |
| `accent` | `oklch(52% 0.17 H)` | `oklch(72% 0.13 H)` | Primary button, links | 5.4:1 | 7.7:1 |
| `accent-fg` | `oklch(100% 0 0)` | `oklch(17% 0.012 H)` | Text on accent | 5.6:1 | 7.7:1 |
| `danger` | `oklch(52% 0.20 25)` | `oklch(72% 0.16 25)` | Errors | 5.9:1 | 7.2:1 |
| `success` | `oklch(50% 0.13 150)` | `oklch(74% 0.14 150)` | Success | 5.4:1 | 8.8:1 |
| `warning` | `oklch(48% 0.09 70)` | `oklch(78% 0.12 80)` | Caution text | 6.4:1 | 9.5:1 |

Contrast is measured against `canvas`, except `accent-fg` (against `accent`). `hairline` is decoration only. Never use it as an input border or the only edge of a control.

### Implementation (Tailwind v4, CSS-first)

```css
/* app/globals.css */
@import "tailwindcss";

/* Light values first = fallback for browsers without light-dark() */
:root {
  --hue: 255;
  --canvas: oklch(98.5% 0.004 var(--hue));
  --surface: oklch(100% 0 0);
  --ink: oklch(22% 0.02 var(--hue));
  --muted: oklch(48% 0.02 var(--hue));
  --line: oklch(62% 0.02 var(--hue));
  --hairline: oklch(92% 0.006 var(--hue));
  --accent: oklch(52% 0.17 var(--hue));
  --accent-fg: oklch(100% 0 0);
  --danger: oklch(52% 0.2 25);
  --success: oklch(50% 0.13 150);
  --warning: oklch(48% 0.09 70);
}

/* light-dark() needs color-scheme; unsupported browsers would lose the colors, hence @supports */
@supports (color: light-dark(white, black)) {
  :root {
    color-scheme: light dark;
    --canvas: light-dark(oklch(98.5% 0.004 var(--hue)), oklch(17% 0.012 var(--hue)));
    --surface: light-dark(oklch(100% 0 0), oklch(21% 0.014 var(--hue)));
    --ink: light-dark(oklch(22% 0.02 var(--hue)), oklch(94% 0.01 var(--hue)));
    --muted: light-dark(oklch(48% 0.02 var(--hue)), oklch(72% 0.015 var(--hue)));
    --line: light-dark(oklch(62% 0.02 var(--hue)), oklch(56% 0.02 var(--hue)));
    --hairline: light-dark(oklch(92% 0.006 var(--hue)), oklch(28% 0.012 var(--hue)));
    --accent: light-dark(oklch(52% 0.17 var(--hue)), oklch(72% 0.13 var(--hue)));
    --accent-fg: light-dark(oklch(100% 0 0), oklch(17% 0.012 var(--hue)));
    --danger: light-dark(oklch(52% 0.2 25), oklch(72% 0.16 25));
    --success: light-dark(oklch(50% 0.13 150), oklch(74% 0.14 150));
    --warning: light-dark(oklch(48% 0.09 70), oklch(78% 0.12 80));
  }
}

/* Manual override (set data-theme on <html>); follows the system when unset */
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }

/* Expose tokens as Tailwind utilities: bg-canvas, text-ink, border-line, bg-accent ... */
@theme inline {
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-hairline: var(--hairline);
  --color-accent: var(--accent);
  --color-accent-fg: var(--accent-fg);
  --color-danger: var(--danger);
  --color-success: var(--success);
  --color-warning: var(--warning);

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;

  --radius-sm: 4px;
  --radius-md: 8px;
}

@layer base {
  html { scroll-padding-top: 5rem; } /* sticky header must not cover focused items (WCAG 2.4.11) */
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
}
```

Use semantic tokens in markup (`bg-surface text-ink border-line`). Do not use `dark:` for these colors, because the tokens already switch. Reserve `dark:` for rare one-off cases.

---

## 6. Layout and responsiveness

### Principles

- `MUST` mobile-first. Unprefixed utilities are the phone layout. `[HEURISTIC]`
- `SHOULD` prefer intrinsic layouts (grid `auto-fill`/`minmax`, `flex-wrap`) over many breakpoints. Add a breakpoint only where the layout actually breaks. `[HEURISTIC]`
- `SHOULD` use **container queries** (`@container`, `@sm:`, `@md:`) for reusable components, such as listing cards that appear in a grid, a sidebar, and a carousel. Use viewport breakpoints only for page-level layout. `[SUPPORT]` Baseline Widely available.
- `SHOULD` use a 4px spacing base (Tailwind's default `1 = 4px`). Prefer these steps: 2, 3, 4, 6, 8, 12, 16. `[HEURISTIC]`
- `SHOULD` use logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) instead of left/right. `[STD]`
- `MUST` the page works at 320px wide with no horizontal scroll, and at 200% zoom with no clipped content. `[STD]` WCAG 1.4.10, 1.4.4

### Responsive patterns

```tsx
{/* Listing grid: columns follow available width, no breakpoints needed */}
<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4">

{/* Page shell: stacked on mobile, sidebar + content from lg */}
<div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[16rem_1fr] lg:px-8">

{/* Full-height section: svh, never vh */}
<section className="min-h-svh">

{/* Sticky mobile action bar, respects the iPhone home indicator */}
<div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">

{/* Touch-aware sizing: bigger on touch, compact with mouse */}
<button className="min-h-11 px-4 pointer-fine:min-h-9">
```

- Breakpoints (Tailwind v4 defaults): `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.
- `svh` for sections that must fit on first load. `dvh` only when live tracking of the browser toolbar matters (it updates in steps, not at 60fps). Neither accounts for the on-screen keyboard, so test input-heavy screens on real phones. `[SUPPORT]`
- `hover:` in Tailwind v4 only applies on hover-capable devices. Use `pointer-coarse:` / `pointer-fine:` for sizing (they need Tailwind 4.1 or newer). On hybrid devices the media query reports the primary input only. `[SUPPORT]`
- `MUST` fixed or sticky bars must never cover focused elements (`scroll-padding`, section 5). `[STD]` WCAG 2.4.11

### Responsive images (`next/image`)

- `MUST` pass `sizes` on every responsive image. Without it, the browser may download the largest version. `[RESEARCH]`
- `MUST` put `priority` on the single LCP image only (the first listing photo on a detail page, or the hero). Not on grids. `[RESEARCH]`
- `MUST` give every image a fixed aspect ratio box (`aspect-[4/3]`, `aspect-square`) with `fill` and `object-cover`.
- `MUST` meaningful `alt` text for listing photos; `alt=""` for decorative images. `[STD]`
- When card width depends on a container instead of the viewport, `sizes` is an approximation. Pick the largest likely width.

---

## 7. Component rules (marketplace)

These are `[HEURISTIC]` patterns tuned for trust and speed. Adapt, but keep the intent.

### Listing card
- Whole card is one tap target using a stretched link (`<a>` on the title with an `::after` overlay). Secondary actions such as "save" sit above it and are at least 44px.
- Order: photo, price (`font-mono tabular-nums`, semibold), title (2-line clamp), meta (location, posted time) in `text-muted text-sm`, then a seller trust line.
- Same aspect ratio for all photos. Skeleton uses the same dimensions as the real card.
- Flat: 1px `border-hairline`, `rounded-md`, no shadow, no hover lift. Hover (pointer devices only) changes the border to `border-line`.

```tsx
<li className="@container">
  <article className="relative grid gap-3 rounded-md border border-hairline bg-surface p-3 hover:border-line @sm:grid-cols-[10rem_1fr]">
    <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-canvas">
      <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw" className="object-cover" />
    </div>
    <div className="flex min-w-0 flex-col gap-1">
      <p className="font-mono text-lg font-semibold tabular-nums">{price}</p>
      <h3 className="line-clamp-2 text-base text-balance">
        <a href={href} className="after:absolute after:inset-0">{title}</a>
      </h3>
      <p className="text-sm text-muted">{location} · {postedAgo}</p>
    </div>
  </article>
</li>
```

### Search and filters
- Search is the most prominent control on browse pages.
- Desktop: filters in a left sidebar. Mobile: one "Filters" button opening a modal `<dialog>` (full height, `svh`), with a sticky "Show N results" button at the bottom.
- Applied filters appear as removable chips (remove button 44px target). Always show the result count and the current sort.
- Empty state: say why, and give one next action (clear filters, widen area). No illustrations needed.

### Listing detail
- Mobile order: gallery, price, title, primary action, seller, details, description, similar items. Primary action ("Propose a deal": buy or exchange) sits in the sticky bottom bar.
- Description text is capped at about `65ch` (`max-w-prose`).
- Seller card: name, verified status (only if truly verified), member since, response time, review count and rating from real data.

### Trust and safety (required surfaces)
- Show payment protection state in plain words at every step ("Payment held until you confirm delivery"), never as a decorative badge.
- Place safety guidance next to the contact and payment actions, not on a separate page.
- Reviews show real counts and dates. Never fabricate, inflate or hide negative reviews.
- Destructive or money-moving actions use a confirm step that repeats the amount and the counterparty.

### Deal thread (no general direct messaging in the MVP)
- Messaging lives inside the deal page, scoped to one deal. Do not build an inbox or chat UI beyond that until it is scheduled.
- Input `text-base` or larger. Messages show timestamps as text. Sent or failed state is text plus icon, not color alone.
- Do not use animated typing dots or "live" pulses unless the underlying state is real.
- Keep a visible reminder near the input: payments and handoff happen on the platform only.

### Forms and checkout
- One column. Visible `<label>` for every field (placeholders are not labels). Inline error text beside the field, `text-danger` plus an icon, linked with `aria-describedby`. `[STD]`
- Use the right `type` and `inputmode` (`email`, `tel`, `numeric`) and `autocomplete` values.
- Show the full price breakdown (item, fees, total) before the final action. One primary button: the final one.

### Deals: sale and exchange
- Sale and exchange proposals share one deal layout. The difference is a "You give / You get" summary: two columns from `@md`, stacked on phones. An exchange shows both items with photos, plus any cash top-up as its own labelled line.
- Show deal status as a text-and-icon chip, never color alone. Use the exact states of the server's deal state machine. The UI never invents or infers a state. Show the status history (from the history table) as a vertical timeline on the deal page.
- Each state shows exactly one primary action for the current user's role (for example seller: "Accept", buyer: "Pay into escrow"). Reject and cancel are secondary and go through a confirm step.
- After a proposal is accepted the listing is locked. Other proposals on it show as disabled with the reason ("Item reserved"), not as errors.

### Money and escrow display
- Money from the API is integer minor units plus a currency code. Format only at the edge with `Intl.NumberFormat`. Never do float math or `parseFloat` on money in the UI. Always show the currency.
- State escrow in plain words: "Waiting for payment", "Payment processing", "Funds secured", "Released to seller", "Refunded". Webhooks are the source of truth for payment state, so never show "Funds secured" until the API reports it. Show "Payment processing" while pending.
- Before payment, show the breakdown: item price, platform fee, total. The seller sees "Funds secured" before the meetup.
- Prices and totals use `font-mono tabular-nums`.

### Safe Handoff screens (highest-stakes UI in the app)
- Each side gets a dedicated, single-purpose, mobile-first route with no navigation clutter.
- **Buyer (code or QR):** show the code large (`text-5xl` or bigger, `font-mono`, digits grouped) with the instruction "Show this only after you have inspected the item." Render the QR dark-on-light with a quiet zone, even in dark mode, so scanners read it reliably. Show when the code expires, in text.
- **Seller (entry):** one input with `inputmode="numeric"` and `autocomplete="one-time-code"` (not a field per digit). Before releasing, a confirm step repeats the amount and the buyer's name.
- Double submits are blocked: disable the button while pending, send an idempotency key, and show a clear pending, retry or failed state for weak networks.
- Errors are specific and calm: wrong code (with attempts left, if the server provides it), expired code, already released.
- Success is a plain confirmation with a receipt link. No confetti, no celebration animation.
- **Exchange dual-lock:** show two parallel rows ("You confirmed" / "Other party confirmed"), each as text plus icon. Say exactly what the screen is waiting for and from whom. Any cash top-up releases only after both are done.

### Trust badge, verified badge and reviews
- Two different things with two different labels: "Verified" (identity or phone) and "Trusted" (completed escrow-backed deals). Never merge or restyle one to look like the other.
- The trust badge appears only for deals completed through escrow handoff. A popover explains it ("N completed Safe Handoff deals"). Reviews appear only from those deals.
- Badges are flat text-and-icon chips. No gold, glow or shine.

### Admin dashboard
- Dense layouts are fine here, but keep keyboard use, 24px minimum targets, and tablet usability.
- Tables: sticky header, server-side pagination, sorting and filtering, filters synced to the URL, row actions in a `[popover]` menu. On narrow containers, tables turn into stacked cards (container query) or scroll horizontally with a visible cue. Never silently truncate.
- Destructive or money-moving actions (ban, refund, force-release, delete listing) use a `<dialog>` confirm with a required reason field, and link to the audit log entry afterward.
- Dispute view: evidence side by side (stacked on small screens), status timeline, one primary action.

### Buttons

| Level | Style | Per view |
|---|---|---|
| Primary | solid `bg-accent text-accent-fg` | one |
| Secondary | `border border-line bg-surface text-ink` | few |
| Tertiary | text only, `text-accent` or `text-ink` | many |
| Destructive | `border border-danger text-danger`; solid only inside a confirm step | rare |

All buttons: `min-h-11` on touch, `rounded-md`, `font-medium`, a visible pressed state (`active:` background shift), and a disabled state that is clearly different and still readable.

### Loading, empty, error
- Skeletons match final dimensions (no layout shift). Use a static fill; skip shimmer. Spinners only for actions under about 3 seconds.
- Every error says what happened and what to do next, in plain words. Never show raw error codes alone.

---

## 8. Motion

Motion explains change. It does not decorate. If removing an animation would not cost the user any understanding, remove it. `[HEURISTIC]`

- `MUST` gate non-essential motion: `motion-safe:transition-colors`, `motion-reduce:transition-none`. `[STD]`
- `SHOULD` keep durations 150-250ms, easing `cubic-bezier(0.2, 0, 0, 1)` (or Tailwind `ease-out`). `[HEURISTIC]`
- `SHOULD` animate only `transform` and `opacity` (they run on the compositor). Do not animate `width`, `height`, `top`, `left`, `margin`. Color and background transitions are fine for small elements. `[RESEARCH]` web.dev
- `SHOULD` use `starting:` for enter transitions on popovers and dialogs (Tailwind v4).
- Allowed: button and link state changes, dialog/sheet/menu enter and exit, skeleton-to-content swap (fade), a filter-result swap via a same-document View Transition.
- Not allowed: autoplay carousels, parallax, scroll-triggered fade-ins on every section, looping or pulsing decoration, bouncing, confetti, animated gradients, count-up numbers, cursor effects.
- View Transitions: same-document (`document.startViewTransition`) is Baseline, but always feature-detect. Cross-document (`@view-transition { navigation: auto; }`) is Chromium and Safari only and applies to full page loads, not Next.js client-side route changes. Treat both as optional enhancement. `[SUPPORT]`

```tsx
function swap(update: () => void) {
  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  document.startViewTransition(update);
}
```

---

## 9. Accessibility checklist (WCAG 2.2 AA)

- Semantic landmarks: one `<main>`, `<header>`, `<nav>` (labelled if more than one), `<footer>`. One `<h1>` per page, no skipped heading levels. `[STD]`
- Everything works by keyboard, in a logical order, with a visible focus ring. `[STD]` 2.1.1, 2.4.7
- Skip link to main content as the first focusable element. `[STD]` 2.4.1
- Focused element is never fully hidden by sticky UI. `[STD]` 2.4.11
- Dialogs: use `<dialog>` with `showModal()` (focus trap and Esc come free). Menus and tooltips: `[popover]`. Do not rebuild these with `div`s. `[STD]`
- Icon-only buttons have `aria-label`. Decorative icons have `aria-hidden="true"`. `[STD]`
- Link text makes sense alone ("View listing", not "Click here"). `[STD]`
- Status changes (added to saved, message sent, error) are announced with `aria-live="polite"` or `role="status"`. `[STD]`
- Drag-only interactions (reorder photos) have a button alternative. `[STD]` 2.5.7
- Forms: labels, `required` or `aria-required`, error text tied to the field, no reliance on color alone. `[STD]`
- Test at 320px width, 200% zoom, in light and dark, with keyboard only, and with a screen reader on at least one flow. `[STD]`

---

## 10. Anti-patterns (the generic "AI-made" look)

All `[HEURISTIC]`: these are recognizable tells, not standards.

| Avoid | Do this instead |
|---|---|
| Pulsing or blinking dots, "live" badges with no real data | Static status text only when the state is real |
| Purple-blue gradients, glowing blobs, neon | One accent on tinted neutrals |
| Glassmorphism and heavy blur on every surface | Solid surfaces with a 1px border |
| Shadow + gradient + hover lift on every card | Flat cards, one overlay shadow for popovers and dialogs only |
| Animation on every scroll or every element | Motion only where it explains a change |
| Identical three-column icon feature grids | Real screenshots, real listings, asymmetric layout when it helps |
| Emoji as icons, stock illustrations | One icon set at one stroke width, real photography |
| Marketing filler ("Revolutionize your workflow") | Specific, concrete wording about what the user can do |
| Fake counters ("12 people viewing", "Only 2 left") | Show real data or nothing |
| Rounded-everything, pill buttons, 24px+ radii | Radius 4-8px, consistent |
| Centered text everywhere | Left-aligned text; center only short hero lines |
| Lorem ipsum or placeholder names left in | Real or realistic content, or clearly marked as sample |

What gives the "technical and minimal" look personality instead: strong typography (sans for UI, mono for numbers), a strict grid, 1px borders, real data shown precisely, generous but consistent spacing.

---

## 11. Browser support status (as of 2026-11-17)

Baseline "Widely available" = safe without fallbacks. "Newly available" = works in all current major browsers but not old ones: provide a fallback or degrade gracefully.

| Feature | Status | Notes |
|---|---|---|
| Container size queries | Widely available (since 2025-08-14) | Use freely |
| Container style queries (`@container style()`) | Newly available (2026-05-19; Firefox 151) | Enhancement only |
| `:has()` | Widely available (due 2026-06-19) | Use freely |
| Subgrid | Widely available (2026-06) | Use freely |
| Native CSS nesting | Widely available (2026-02) | Tailwind handles it anyway |
| `oklch()`, `lab()`, `oklab()` | Baseline 2023 (Chrome/Edge 111, Firefox 113, Safari 15.4), about 93% usage | Use; hex fallback only if you target old browsers |
| `color-mix()` | Widely available (2025-10) | Use freely |
| `light-dark()` | Newly available 2024-05 (Chrome/Edge 123, Firefox 120, Safari 17.5); about 91% usage; reaches Widely available about now (2026-11) | Needs `color-scheme`. Keep the `@supports` fallback from section 5 |
| `text-wrap: balance` | Baseline 2024 | Short blocks only |
| `text-wrap: pretty` | Narrower support | Enhancement only |
| `svh`, `lvh`, `dvh` | Chrome/Edge 108, Firefox 101, Safari 15.4 | Add `vh` fallback only for very old browsers |
| `[popover]` | Newly available 2024-04; Widely available from about 2026-10 (30 months later) | Native; prefer over custom menus |
| `<dialog>` | Widely available | Use for modals |
| View Transitions, same-document | Newly available (Chrome/Edge 111, Safari 18, Firefox 144) | Feature-detect; optional |
| View Transitions, cross-document | Chrome/Edge 126, Safari 18.2; not Firefox | Optional; full page loads only |
| `hover`, `pointer` media queries | Broadly supported | Android long-press can emulate hover; hybrids report primary input only |

Use `@supports` for any feature not in "Widely available" when the fallback is cheap.

---

## 12. Performance rules (phones with mixed networks)

- `MUST` use `next/font` (self-hosted, subset). Never load fonts from a `<link>` to Google Fonts. `[RESEARCH]`
- `MUST` set `sizes` and use a single `priority` LCP image. `[RESEARCH]`
- `SHOULD` lazy-load everything below the fold (default behavior of `next/image`).
- `SHOULD` load heavy client-only components (maps, charts, rich editors) with `next/dynamic`, only when needed. `[RESEARCH]`
- `SHOULD` keep Server Components as the default; add `"use client"` only for interactivity.
- `SHOULD` reserve space for every async region (skeleton with final dimensions).
- `AVOID` large icon libraries imported wholesale; import individual icons.
- `AVOID` layout-triggering animations (section 8).

---

## 13. Self-review checklist (run before finishing any UI task)

1. One primary action per view? Everything else visibly quieter?
2. Colors come from tokens only? Any new color checked for contrast (4.5:1 text, 3:1 UI)?
3. All touch targets at least 44px, and nothing under 24px?
4. Focus ring visible on every interactive element? Keyboard path works?
5. Layout verified at 320px, about 768px, and about 1280px? No horizontal scroll?
6. Sections use `svh`, not `vh`? Sticky bars use safe-area padding?
7. Images: `sizes`, aspect-ratio box, one `priority` at most, real `alt`?
8. Text: body 16px+, line length about 65ch, fluid sizes use `rem` bounds and pass a 200% zoom check?
9. Motion: only `transform`/`opacity`, gated by `motion-safe`, nothing from the "not allowed" list?
10. Nothing hidden behind hover. Nothing relying on color alone?
11. No anti-patterns from section 10? No fake urgency, fake counters, or decorative trust badges?
12. Dark mode checked? Light mode checked?
13. List every assumption you made (missing brand values, copy, data) in your reply.

---

## Sources

- Container queries status: [web-platform-dx feature explorer](https://web-platform-dx.github.io/web-features-explorer/features/container-queries)
- Baseline 2023 (container queries, OKLCH, `color-mix`, subgrid, `:has()`): [web.dev](https://web.dev/blog/baseline2023)
- `:has()` status: [web-platform-dx feature explorer](https://web-platform-dx.github.io/web-features-explorer/features/has)
- Subgrid, nesting, popover statuses: [web.dev, new in the web (I/O 2024)](https://web.dev/blog/new-in-the-web-io2024)
- `light-dark()`: [MDN](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark)
- `text-wrap`: [MDN](https://developer.mozilla.org/docs/Web/CSS/text-wrap), [specification.website](https://specification.website/spec/foundations/text-wrap/)
- Viewport units: [web.dev](https://web.dev/viewport-units/), [specification.website](https://specification.website/spec/performance/dynamic-viewport-units.md)
- WCAG 2.2 target size (2.5.8, 2.5.5): [Deque University](https://dequeuniversity.com/resources/wcag-2.2), [TetraLogical](https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2)
- WCAG 1.4.11 non-text contrast: [W3C Understanding 1.4.11](https://w3c.github.io/wcag21/understanding/non-text-contrast)
- WCAG 2.3.3 animation from interactions: [W3C Understanding 2.3.3](https://w3c.github.io/wcag/understanding/animation-from-interactions.html)
- Fluid type and WCAG 1.4.4: [Smashing Magazine](https://smashingmagazine.com/2023/11/addressing-accessibility-concerns-fluid-type)
- Line length: [Baymard Institute](https://baymard.com/blog/line-length-readability)
- Animation performance: [web.dev](https://web.dev/articles/animations-guide)
- View Transitions: [web.dev, same-document Baseline](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available), [Chrome for Developers, cross-document](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/cross-document-transitions)
- Hover and pointer media queries: [web.dev](https://web.dev/learn/design/interaction), [CSS-Tricks](https://css-tricks.com/?p=320427)
- Laws of UX: [lawsofux.com](https://lawsofux.com/index.md)
- Tailwind v4 (`@theme`, container queries, variants): [Tailwind docs, theme](https://tailwindcss.com/docs/theme), [container queries](https://tailwindcss.com/docs/container-queries), [state variants](https://tailwindcss.com/docs/hover-focus-and-other-states)
- Next.js image: [Next.js Image docs](https://github.com/vercel/next.js/blob/87301834b34fa5c6ee65c6e89b1d912e43c8b771/docs/02-app/02-api-reference/01-components/image.mdx)
