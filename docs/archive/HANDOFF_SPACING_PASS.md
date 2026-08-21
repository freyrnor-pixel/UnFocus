# Handoff — spacing pass (branch `claude/handoff-spacing-pass-b0v4dj`)

**Status: done.** This doc is a record of what was found and fixed, not a
pending-work handoff — the original version of this file (written by an
earlier session) was never committed before its container was recycled, so
this session re-derived the audit from scratch and reconciled it against
actual render context before touching anything.

## What prompted this

A prior chat (different session, branch `claude/app-spacing-text-sizing-4fly94`,
never pushed) ran an audit of spacing/font-size consistency across the app and
pasted its punch list into this conversation. Most items in that punch list
turned out to be **false positives once checked against the actual render
context** — see "Reviewed, not changed" below. Only the items that were
genuine, unambiguous inconsistencies were fixed.

## What was actually wrong — and fixed

**1. `Layout.cardPadding/cardPaddingV/cardPaddingH/cardGap/maxVisible` in
`constants/theme.ts` was completely dead code.** Zero call sites anywhere in
`app/`, `components/`, `lib/`, or `store/` — confirmed by grep. Meanwhile
`SPACING_LAYOUT_LIBRARY.md`, `CARD_CONTAINER_LIBRARY.md`,
`FORM_PATTERNS_LIBRARY.md`, and `SHADOW_ELEVATION_LIBRARY.md` all documented
it (~50 references combined) as "the standard," at the wrong value (18px) —
real cards had already converged on `Spacing.md` (16px) everywhere, with zero
awareness the `Layout` token existed. This is likely why cards read as
inconsistent: **there was no live standard being enforced, just a stale one
being documented.**
   - Removed the `Layout` export from `constants/theme.ts`.
   - Rewrote all four docs' `Layout.*` references to `Spacing.md`, and fixed
     the "18px/14px" prose to say the real number (16px), or removed it
     where it no longer applied (`Layout.maxVisible` had no real-world
     equivalent — just deleted that section).

**2. `app/(tabs)/plans.tsx`'s `content` style had `paddingBottom: Spacing.xl`**
(32px) vs. `Spacing.md` (16px) used by Home (`app/(tabs)/index.tsx:292`) and
Health (`app/(tabs)/health.tsx:895`) for the same role. No comment justified
it, and Plans has no FAB requiring extra bottom clearance (checked — no
`AddFAB` import). Changed to `Spacing.md` to match.

**3. Magic-number bottom spacers.** `app/(tabs)/health.tsx:887` and
`app/health-log.tsx:124` both had a bare `<View style={{ height: 80 }} />` as
the final scroll spacer. Replaced with `Spacing.xl + Spacing.xxl` (32+48=80)
— same rendered value, but now token-composed instead of a raw literal, per
`SPACING_LAYOUT_LIBRARY.md` Rule 1 ("Use Tokens, Never Hardcode"). Did not
change the actual height — no visual risk, no device needed to verify.

## Reviewed, not changed (and why)

The pasted audit flagged several more things that looked like bugs on paper
but weren't, once checked against the actual component/render context. Worth
recording so a future pass doesn't re-flag the same false positives:

- **Shopping Weekly tab's `gap: Spacing.md` vs. Monthly tab's `bodyGap:
  Spacing.xl`** (`app/(tabs)/shopping.tsx`) — audit claimed these were "the
  same conceptual gap" at different values. They're not: `styles.content`
  (16px) is the *outer* block-stacking gap shared by every tab (HintCard →
  SharedRequestsSection → tab body — Weekly and Monthly both live at this
  level, at the same 16px). `styles.bodyGap` (32px) is a *different*, more
  nested gap — between named sub-sections *inside* the Monthly tab's single
  `catalogCard` Surface, per the Decision 043 comment already in that file.
  Applying 32px to Weekly's outer stack would have been a real regression,
  not a fix.
- **Single-glyph day-abbreviation and date labels at 7–9px**
  (`app/(tabs)/health.tsx`: `ailmentDayAbbr`, `dayAbbr`, `weekGridDayAbbr`,
  `weekGridDate`, `monthDotDate`) — these render single characters or 2-digit
  numbers inside small calendar-grid cells/dots (~18–24px), not body/caption
  text. Bumping to the `FontSize.xs` (12px) floor risked text overflow
  inside those small circular/grid cells with no way to verify visually in
  this environment (no device, and the web preview isn't pixel-faithful for
  this kind of tight-fit check). Left as-is.
- **Shopping tab-count badge at `fontSize: 10`**
  (`app/(tabs)/shopping.tsx:1191`, `tabBadgeText`) — same reasoning: a
  number inside an 18×18 circular badge, appropriately sized for that
  container. Not a body-text role.
- **Card padding differences across `TaskCard.tsx` (16h/8v), 
  `SharedRequestsSection.tsx` (8 all sides), `AddItemSheet.tsx` (24 all
  sides)** — these are three different card *roles* (list row / compact
  inline widget / modal sheet), not the same component with drifted values.
  Homogenizing them without visual sign-off risked changing established
  layouts for no confirmed benefit. Left as-is; flagged here in case a
  future visual-design pass wants to revisit deliberately, with a device or
  screenshots in hand.
- **Home's greeting at `FontSize.xxl` (28px) vs. `ScreenHeader`'s title at
  `FontSize.xl` (22px)** — Home's greeting is a distinct hero-style welcome
  text, not an instance of the shared `ScreenHeader` title component; the
  size difference may be a deliberate "Home feels more welcoming" choice
  rather than drift. No comment either way. Left as-is — this is a visual
  design call, not a token-consistency bug, and shouldn't be changed without
  someone actually looking at both screens side by side.

## Verification

- `npx tsc --noEmit` — clean.
- `scripts/test-changed.sh` — no related Jest tests exist for the touched
  files (pure layout/token changes, no logic); nothing to run.
- Not verified: pixel-level visual confirmation on Plans/Health/Shopping
  (no device, and the changes here are either zero-visual-diff by
  construction — Layout removal, height:80 tokenization — or a single
  16px-vs-32px bottom-padding delta on Plans that's low-risk to eyeball on
  next OTA).

## Publishing

Per this repo's standing rule (`CLAUDE.md`/`AGENTS.md`): commit on
`claude/handoff-spacing-pass-b0v4dj`, push, open a PR into `main`, and merge
it — done as part of landing this doc.
