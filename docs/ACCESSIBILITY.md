# Accessibility and responsive audit

Scope: the public browse/detail flow, auth, profile/settings, the deal flow
(proposal, thread, escrow, handoff, dispute, review), admin dashboard, and the
report flow. Method: component-level review against WCAG 2.1 AA, plus a mobile
layout pass at 375px and 768px.

## Result

No blocking issues remain on the core flows. Fixes made in this pass are listed
below; items already correct are recorded so they are not regressed.

### Fixed in this pass

- **Keyboard visibility of the image-delete control.** The button was
  `opacity-0` until hover, so a keyboard user tabbing onto it could not see
  where focus was. Now `group-focus-within:opacity-100` and
  `focus-visible:opacity-100` reveal it.
- **Star-rating state.** Each star button in the review form now exposes
  `aria-pressed`, so a screen reader announces which rating is selected rather
  than only the button label.
- **Tab semantics.** The deals view and admin dashboard used `role="tab"`
  without a matching tabpanel. They now wire `aria-controls`, `aria-labelledby`,
  `tabIndex` roving, and arrow-key navigation between tabs, with a labelled
  `role="tabpanel"` wrapping the content.

### Already correct (verified, keep it this way)

- **Focus indicator.** A global `:focus-visible` rule draws a 2px ring with an
  offset in both themes. No component suppresses it.
- **Skip link.** The root layout provides a "Skip to content" link targeting
  `#main`.
- **Reduced motion.** `prefers-reduced-motion` disables animations and smooth
  scrolling.
- **Form controls.** `TextField`, `TextArea`, and `Select` generate ids with
  `useId`, associate a visible `<label>`, link hints and errors via
  `aria-describedby`, mark errors `role="alert"` and `aria-invalid`, and default
  buttons to `type="button"`.
- **Icon-only controls.** Theme toggle, gallery arrows/dots, and image delete
  have `aria-label`s; decorative SVGs are `aria-hidden`.
- **Colour contrast.** Tokens meet AA in both themes: muted text is about 7:1,
  status colours (success/warning/danger/info) are 4.5:1 or better against
  their surfaces, and focus rings are distinct from backgrounds.
- **Live regions and status.** Alerts use `role="alert"`, the browse result
  count uses `role="status"`, and pending buttons expose `aria-busy`.
- **Headings.** Each page has one `h1`; sections use `h2`/`h3` in order via
  `aria-labelledby` on `<section>` elements.
- **Object-level privacy.** Public profiles and seller cards never expose an
  email address, and the API omits password hashes (see `docs/SECURITY.md`).

### Responsive layout

- The header shows a compact brand + theme control on mobile and a bottom tab
  bar (`md:hidden`) for primary navigation; `<main>` reserves `pb-16` so the
  bar never covers content.
- Browse filters live in a sidebar on desktop and a collapsible panel on
  mobile. Grids step from one column to two at `sm` and three at `lg`.
- Deal, dispute, report, and admin cards wrap with `flex-wrap` and use full-width
  controls below `sm`.
- Tables are avoided for data; list items stack on narrow screens.

## Remaining manual checks (staging)

Run axe DevTools / Chrome Lighthouse and VoiceOver or NVDA on the core flows
with real content. Automated checks cannot confirm reading order or the
quality of announcement text, so these remain open until staging is available.
