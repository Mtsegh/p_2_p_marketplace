# P_2_P Marketplace: Design Rules

Place this file at `docs/DESIGN-RULES.md` and reference it from `AGENTS.md`.
Applies to every chunk in the build plan. If a rule here conflicts with `AGENTS.md`, `AGENTS.md` wins; tell the user about the conflict.

## How to use this file (read first)

1. Before writing any UI or API code, read the relevant Part (A = client, B = server).
2. Follow rules literally. MUST = required. NEVER = forbidden. SHOULD = default, deviate only with a stated reason.
3. Do not invent new colors, spacing values, endpoints shapes, or error formats. Use the tokens and patterns below.
4. Before saying a task is done, run the Definition of Done (Part C) and fix every failure.
5. If a rule is unclear or a decision is missing (e.g. styling library, payment gateway), STOP and ask the user. Do not guess.

Product principle: this is a **trust** product ("Safe Handoff"). Every screen involving money or a deal must make the current state, the next action, and who is responsible obvious in under 3 seconds.

---

# PART A: Client (Next.js, TypeScript)

## A1. Stack defaults
- Styling: **Tailwind CSS** with design tokens as CSS variables. Components: **Radix UI primitives** (via shadcn/ui pattern) for accessible dialogs, menus, tabs, toasts. (If the user has chosen differently, follow their choice.)
- Forms: `react-hook-form` + `zod` (same schema shape as server where possible; no shared code, copy the shape).
- Data fetching: TanStack Query for client state from the API; Next.js Server Components for first paint of public pages (browse, listing detail).
- Icons: one icon set only (Lucide). NEVER mix icon sets. NEVER use emoji as UI icons.
- Fonts: one sans family via `next/font` (Inter or Geist), plus optional mono for handoff codes. NEVER load fonts from a `<link>` tag.

## A2. Design tokens (single source of truth)
Define once in `client/app/tokens.css` (imported from `client/app/globals.css`). NEVER hardcode hex values, pixel sizes, or shadows in components; use tokens/Tailwind classes only.

**Color roles** (define light and dark values for each):
`--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--primary`, `--primary-foreground`, `--success`, `--warning`, `--danger`, `--info`, `--focus-ring`.
- One brand/primary color. Neutrals do 90% of the work; color is for actions and status.
- Status color is ALWAYS paired with an icon or text label. NEVER convey state by color alone.
- Text contrast: body ≥ 4.5:1, large text and UI borders ≥ 3:1 (WCAG 2.2 AA). Check both themes.
- Dark mode is required: respect `prefers-color-scheme`, allow manual toggle, no flash on load.

**Spacing**: 4px base scale only: 4, 8, 12, 16, 24, 32, 48, 64, 96. NEVER use odd values (13px, 17px).

**Radius**: three sizes only: `sm` 6px (inputs, chips), `md` 12px (cards, buttons), `lg` 20px (modals, sheets). Fully round only for avatars and pills.

**Elevation**: three levels (none, `shadow-sm` cards, `shadow-lg` overlays). Soft, low-opacity shadows. Prefer a 1px border over shadow for cards.

**Typography scale** (rem): 12, 14, 16 (body default), 18, 20, 24, 30, 36.
- Body 16px min on mobile, line-height 1.5. Headings line-height 1.2–1.3.
- Max 2 font weights in use per screen (400/500 body, 600 headings).
- Line length for reading text: 60–75 characters (`max-w-prose`).
- Numbers in tables, prices and codes: `font-variant-numeric: tabular-nums`.

**Motion**:
- Durations: 120ms (hover/press), 200ms (enter/exit), 300ms max (page-level). Easing: ease-out for enter, ease-in for exit.
- Animate only `transform` and `opacity`. NEVER animate width/height/top/left.
- MUST honor `prefers-reduced-motion: reduce` (disable non-essential motion).
- Motion explains change (item added, panel opened). NEVER decorative looping animation.

## A3. Layout and responsiveness
- **Mobile-first.** Design at 360px width first, then enhance at `sm 640`, `md 768`, `lg 1024`, `xl 1280`.
- Content max width 1280px, centered; page gutters 16px mobile, 24px tablet, 32px desktop.
- NEVER horizontal page scroll at any width from 320px up. Test at 320, 375, 768, 1024, 1440.
- Touch targets ≥ 44×44px, with ≥ 8px between adjacent targets.
- Primary actions in thumb reach on mobile (sticky bottom action bar for deal actions).
- Navigation: bottom tab bar on mobile (Browse, Sell, Deals, Profile), top bar on desktop. Max 5 primary items.
- Use CSS grid/flex. NEVER use fixed pixel heights for text containers. Use `min-h-dvh`, not `100vh`.
- Respect safe areas on mobile (`env(safe-area-inset-*)`).

## A4. Components and states
Build each reusable component once in `client/components/ui/`. Pages compose them. NEVER copy-paste styled markup between pages.

Every interactive component MUST define all of: default, hover, focus-visible, active/pressed, disabled, loading, and error (where applicable).

Every data view MUST implement all four states. A screen without them is not done:
1. **Loading**: skeletons matching the final layout (no layout shift). Spinners only for button actions.
2. **Empty**: explain why it is empty and give one clear action ("No listings yet. Create your first listing").
3. **Error**: plain-language message, what happened, a retry action. NEVER show raw error text, stack traces, or status codes to users.
4. **Success/content**.

Buttons:
- One primary button per view region. Secondary = outline, tertiary = text. Destructive = danger color and requires confirmation.
- Label with verb + object ("Accept proposal", not "OK" or "Submit").
- On click for async actions: disable, show inline spinner, keep label width stable. Prevent double-submit.

Forms:
- Visible label above every input (placeholders are NOT labels). Helper text below. Errors below the field, linked with `aria-describedby`, shown on blur and on submit.
- Use correct `type`, `inputmode`, and `autocomplete` (email, tel, numeric, one-time-code).
- Preserve user input on error. Focus the first invalid field on submit failure.
- Mark optional fields as "(optional)", not required ones with asterisks everywhere.
- Long forms (create listing) split into steps with a progress indicator and autosaved draft.

Feedback:
- Toasts for low-stakes confirmations (auto-dismiss 5s, `role="status"`). Inline banners for things that block progress. Dialogs only for decisions that need confirmation.
- Optimistic UI only where rollback is safe. NEVER be optimistic about money or deal state; show the real server state.

## A5. Marketplace-specific patterns

**Listing card**: 4:3 image (lazy loaded, blurred placeholder), price (prominent), title (max 2 lines, truncated), location + posted time, badges (verified seller, "Open to swap"). The whole card is one link. Price is formatted via `Intl.NumberFormat` with the currency code from the API. NEVER format money by hand or do float math on it (see Part B money rule).

**Listing type clarity**: every listing visibly shows **Sale**, **Swap**, or **Sale or Swap**. Use a consistent badge.

**Listing detail**: image gallery with swipe on mobile and keyboard arrows on desktop, price, seller card with trust signals, clear primary CTA ("Make an offer" / "Propose a swap"), description, attributes, similar items.

**Search and filters**: search box always visible; filters in a bottom sheet on mobile, sidebar on desktop; active filters shown as removable chips; result count shown; filter state lives in the URL query string (shareable, back-button safe). Debounce typing 300ms.

**Pagination**: infinite scroll on browse feeds MUST have a "Load more" fallback button and preserve scroll position on back navigation.

**Deal status UI (Safe Handoff).** This is the most important screen type.
- Show a **stepper/timeline** of the deal: Proposed → Accepted → Funds secured → Handoff → Completed (exchange adds dual confirmation). Current step highlighted, past steps checked.
- Always show, in plain words: *current state*, *what you need to do next*, *what the other person is doing*.
- Escrow messaging: use "Funds secured by [Platform]" with a shield icon for the seller; "Your payment is protected until you confirm the item" for the buyer.
- **Handoff code**: large, high-contrast, monospace, grouped (e.g. `482 915`), with a QR alternative, a "keep this private until you have inspected the item" warning, and a screen-brightness-friendly light surface even in dark mode. Seller entry screen: numeric keypad input, auto-advance, clear success and failure states.
- Destructive or money-moving actions (accept, cancel, release, dispute) require a confirmation step that restates the amount, the item, and the consequence.
- Show timestamps relative ("2 hours ago") with absolute time on hover/long-press.

**Trust signals**: verified badge, completed-deal count, review score only from escrow-backed deals. NEVER show fake or placeholder reviews or counts. NEVER show unverified claims as verified.

**Images**: upload with progress, client-side resize/compress before upload, reorder and delete, alt text defaults to the listing title. First image is the cover.

**Currency and locale**: store and display currency per API response. Default locale from user settings. Support NGN (₦) formatting correctly. NEVER assume USD or a single currency.

## A6. Accessibility (WCAG 2.2 AA, required)
- Use semantic HTML first (`button`, `a`, `nav`, `main`, `h1–h6`, `ul`). NEVER use `div`/`span` with click handlers.
- One `h1` per page; headings in order.
- Every interactive element is keyboard reachable with a visible `:focus-visible` ring (2px, ≥ 3:1 contrast). NEVER `outline: none` without a replacement.
- Modals trap focus, close on Escape, return focus to the trigger, and set `aria-modal`.
- Images have meaningful `alt` (empty `alt=""` for decorative). Icon-only buttons have `aria-label`.
- Live updates (toasts, deal status changes) use `aria-live="polite"`.
- Support zoom to 200% and text resize without loss of content. Don't disable pinch zoom.
- Skip-to-content link on every page.
- Language attribute set on `<html>`.

## A7. Performance (client budget)
- Targets on a mid-range phone over 4G: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Use `next/image` for all images with explicit width/height or `fill` + sizes; AVIF/WebP; lazy load below the fold; only the first listing image is `priority`.
- Use Server Components by default; add `"use client"` only where interactivity requires it, and push it as far down the tree as possible.
- Route-level code splitting; dynamic import heavy components (gallery, charts, QR scanner).
- NEVER ship a large dependency for a small job (no moment.js, no full lodash). Check bundle impact before adding a dependency.
- Reserve space for images and async content to prevent layout shift.
- Network is unreliable: show offline/slow states, retry with backoff, never lose a half-filled form.

## A8. UX principles checklist
- One primary goal per screen. Remove anything that doesn't serve it.
- Progressive disclosure: show essentials first, advanced options behind "More".
- Consistent patterns: same action looks and lives in the same place everywhere.
- Plain language, active voice, no jargon, no blame ("We couldn't save your listing. Try again.").
- Never make users re-enter data you already have.
- Make irreversible actions hard to do by accident and reversible actions easy to undo.
- Sign-in required only at the moment it's needed; browsing and searching are public.
- Copy tone: friendly, calm, confident. Money and safety messages are precise and never playful.

## A9. Client anti-patterns (do not produce these)
- Walls of unstyled text, default browser buttons, default blue links.
- More than 2 competing primary buttons; gradients on everything; heavy drop shadows; neon colors.
- Placeholder-as-label inputs; modals on top of modals; infinite spinners with no timeout.
- Inline styles; magic numbers; `!important`; z-index wars (use a defined scale: base 0, sticky 10, dropdown 20, modal 30, toast 40).
- Lorem ipsum or "TODO" text left in UI. Console errors or warnings in the browser.
- Layout that only works at one screen width.

---

# PART B: Server (Node.js, Express, TypeScript)

## B1. Layering (strict)
```
route (HTTP only) → controller (parse/validate, shape response) → service (business rules, transactions) → repository (Prisma queries)
```
- Routes and controllers contain NO business logic. Services contain NO `req`/`res`. Only repositories touch Prisma.
- Folder by feature (`server/src/modules/listings/…`), not by file type.
- One responsibility per file; files over ~300 lines get split.
- No circular imports. No global mutable state. Dependency injection via function parameters or a small factory, to keep services testable.
- External systems (payment gateway, email, storage) sit behind interfaces (`PaymentProvider`, `Mailer`, `Storage`) so they can be swapped and faked in tests.

## B2. REST API conventions (`/api/v1`)
- Plural nouns, kebab-case: `/api/v1/listings`, `/api/v1/deals/:dealId/proposals`. No verbs in paths, except explicit actions: `POST /deals/:id/accept`, `POST /deals/:id/handoff/confirm`.
- Methods: `GET` read (no side effects), `POST` create/action, `PATCH` partial update, `DELETE` remove. NEVER mutate on `GET`.
- Status codes: 200 OK, 201 Created (+ `Location`), 204 No Content, 400 malformed, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (state/double-sell), 422 validation failed, 429 rate limited, 500 unexpected.
- JSON fields in `camelCase`. IDs are opaque strings (UUID/cuid). Timestamps ISO 8601 UTC.
- **Money**: `{ "amount": 150000, "currency": "NGN" }` integer minor units. NEVER floats, NEVER pre-formatted strings.
- **Success shape**: `{ "data": … , "meta": … }`. **Error shape** (always this, everywhere):
```json
{ "error": { "code": "DEAL_STATE_INVALID", "message": "Human readable summary", "details": [{ "field": "amount", "issue": "must be positive" }], "requestId": "…" } }
```
  `code` is a stable UPPER_SNAKE constant clients can switch on. NEVER leak stack traces, SQL, or internal paths.
- **Pagination**: cursor-based for feeds (`?limit=20&cursor=…`, response `meta.nextCursor`); default limit 20, max 100. NEVER unbounded lists.
- Filtering/sorting via query params with an allow-list. Reject unknown sort fields.
- Additive changes only within `v1`; breaking changes need `v2`.
- Document every endpoint (request, response, errors, auth) in `docs/api/` (OpenAPI or markdown) in the same change that adds it.

## B3. Validation, auth, and security
- Zod validates ALL input (body, query, params, headers where used) at the controller boundary. Unknown keys stripped or rejected. Derive TypeScript types from schemas.
- AuthN: short-lived access token + rotating refresh token in httpOnly, Secure, SameSite cookie; argon2 for passwords; hash and rotate on reuse detection.
- AuthZ: check ownership/role in the **service** layer for every resource access (a user can only touch their own listings and deals). NEVER trust IDs or roles from the client body.
- Rate limit (Redis) per IP and per user; stricter on login, signup, password reset, handoff-code attempts (lock after N failures).
- Security headers (`helmet`), strict CORS allow-list, request body size limits, no secrets in logs, no secrets in repo.
- Handoff codes: cryptographically random, single-use, expire, stored hashed, constant-time compare, attempt limits.
- Never reveal whether an email exists on login/reset responses.
- Uploads: validate type by content (not extension), size limit, generate server-side filenames, signed URLs for S3.

## B4. Data and consistency
- Money integers + currency. Statuses are enums. Every table has `id`, `createdAt`, `updatedAt`. Soft-delete only where history matters.
- Index every foreign key and every column used in `WHERE`/`ORDER BY` on hot paths. Review slow queries with `EXPLAIN`.
- No N+1 queries: use Prisma `include`/`select` deliberately; select only needed fields.
- Multi-step writes run in ONE transaction (accepting a proposal locks listings + creates deal + history row together). Use row locks or unique constraints to prevent double-selling.
- Deal and payment status changes ONLY through the state machine, each writing a history row. NEVER set status directly.
- Webhooks are the source of truth for payment state: verify signature, idempotent handler (store event id), respond fast, process via queue.
- Gateway calls carry idempotency keys. Retries with exponential backoff; dead-letter failures.
- Background work (emails, payouts, expiry timers) runs in BullMQ workers, never inside request handlers.
- Migrations are forward-only, reviewed, and safe for zero downtime (add nullable → backfill → enforce).

## B5. Reliability and observability
- Central error handler: maps known `AppError(code, status, message)` to the error shape; unknown errors → 500 with generic message, full detail logged.
- Structured JSON logs (pino) with `requestId`, `userId`, `dealId` where relevant. Log events, not secrets or PII (mask emails/phones, never log tokens, codes, card data).
- Health endpoints: `/health/live` (process up) and `/health/ready` (DB + Redis reachable).
- Graceful shutdown: stop accepting requests, finish in-flight, close DB/Redis/queues.
- Timeouts on every outbound call. No unbounded retries.
- Config only through the zod-validated env module. App fails fast on startup if env is invalid. Keep `.env.example` current.

## B6. Testing expectations
- Unit tests for services and the state machine (every legal and illegal transition).
- Integration tests for each endpoint against a real test PostgreSQL (happy path, validation error, unauthorized, forbidden, conflict).
- Tests for money paths: escrow hold, release, refund, webhook replay (idempotency), double-accept race.
- Tests are deterministic: no real network, fake the `PaymentProvider`, `Mailer`, `Storage`.
- A bug fix includes a test that failed before the fix.

## B7. Server anti-patterns (do not produce these)
- Business logic in routes; Prisma calls in controllers; `any` types; `console.log` in committed code.
- Floats for money; string statuses without an enum; trusting the client for price, role, or ownership.
- Returning DB models directly (always map to a response DTO; never expose password hashes, tokens, internal flags).
- Catch-and-ignore errors; `try/catch` that swallows; unhandled promise rejections.
- Doing slow work (email, image processing, gateway calls) synchronously in the request path.
- Inconsistent error shapes or ad-hoc response formats per endpoint.

---

# PART C: Definition of Done (run before finishing any chunk)

**Always**
- [ ] `lint`, `typecheck`, and `test` all pass (client and/or server, whichever changed).
- [ ] No new `any`, `console.log`, TODO, commented-out code, or unused exports.
- [ ] No secrets committed; `.env.example` updated if config changed.
- [ ] Docs updated (`docs/api/` for endpoints; README if setup changed).
- [ ] Conventional Commit message used.

**Client UI chunk**
- [ ] Only design tokens used (no hardcoded colors, sizes, shadows).
- [ ] Works at 320, 375, 768, 1024, 1440 px with no horizontal scroll.
- [ ] Light and dark themes both checked for contrast.
- [ ] Loading, empty, error, and success states all implemented.
- [ ] Keyboard-only walkthrough works; focus ring visible; screen-reader labels present.
- [ ] Touch targets ≥ 44px; forms have labels, validation, and preserve input on error.
- [ ] Images use `next/image` with dimensions; no layout shift.
- [ ] Reduced-motion respected.
- [ ] No browser console errors or warnings.
- [ ] Money/trust/deal screens show state, next action, and confirmations per A5.

**Server chunk**
- [ ] Layering respected (route → controller → service → repository).
- [ ] Zod validation on all inputs; error shape matches B2.
- [ ] Authorization checked in the service for every resource.
- [ ] Money as integer minor units + currency.
- [ ] Multi-step writes in a transaction; state changes via state machine with history.
- [ ] Slow/external work is queued; outbound calls have timeouts.
- [ ] Tests cover happy path, validation failure, unauthorized, forbidden, conflict.

**If any box cannot be checked, say so explicitly in the final message instead of claiming completion.**

---

# Settled decisions (do not reopen without a written reason)

- **Client layout**: the Next.js app stays at `client/app` (no `src/` move). `@/*` maps to `client/*`, so `@/components/ui/button` resolves to `client/components/ui/button.tsx`.
- **Registration conflict**: `POST /api/v1/auth/register` returns an explicit `409 EMAIL_IN_USE` error. This is a deliberate UX trade-off: the endpoint becomes a membership oracle, so registration is limited to 5 requests per hour per IP. Login and password recovery stay uniform and never reveal whether an email exists.
- **Avatar in chunk 7**: the profile shows generated initials only. Real avatar upload arrives in chunk 10 with the S3 pre-signed upload flow.
- **Phone verification in chunk 8**: optional for browsing and creating listings; required before a user can accept a paid proposal (chunks 17 to 18). `verificationLevel` is derived from `emailVerifiedAt` and `phoneVerifiedAt`, never stored separately.
- **Cookie and domain strategy**: staging and production serve the client and API from subdomains of one registrable domain (`app.example.com`, `api.example.com`). The refresh cookie is `httpOnly`, `Secure`, `SameSite=Lax`, and scoped to `/api/v1/auth`. Separate registrable domains are not supported because they force `SameSite=None`.
- **CSS framework**: Tailwind CSS (already installed). The component library choice is still open (see below).

# Open items (ask the user, do not decide alone)
- Component library confirmation (Radix primitives via the shadcn/ui pattern is the working assumption).
- Brand primary color, logo, and font choice (until decided, use a neutral placeholder palette defined in `tokens.css`).
- Payment gateway and platform fee (affects checkout and escrow copy).
- Supported currencies and locales at launch.
