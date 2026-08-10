/**
 * colors.ts — Decision 006 colour theme token layer
 *
 * Single named theme (Default) with complete light and dark palettes.
 * Token names are semantic, not color-based.
 *
 * Token list (closed set — both modes provide all of these):
 *   Surfaces: bg, surface, surfaceMuted, surfaceInset, rule
 *   Text: text, textMuted, textInverse
 *   Borders: border, borderStrong
 *   Accent: accent, accentSoft, accentInk
 *   Semantic state: good, goodSoft, bad, badSoft, warn, warnSoft
 *   Depth: shadow, overlay
 *   Hint card: hintBg, hintBorder, hintAccent
 *   Feature accents (former screen hues — lib/screenColor.ts, RETIRED 2026-07-31 addendum A.5,
 *     zero production consumers, kept dormant/contrast-tested only): featTask, featPlan,
 *     featHabit, featShop, featMeal, featBudget, featNote, featHealth, featScan
 *   Card identity hues (lib/domainColor.ts, drives card badge+wash+edge — COLLAPSED from
 *     nine hues to FOUR on 2026-07-31, addendum A.3; the nine token names all still exist
 *     and now alias four values, see the card block below): cardTask, cardPlan, cardHabit,
 *     cardShop, cardMeal, cardBudget, cardNote, cardHealth, cardScan
 *   Priority ramp (reserved, unwired — no live UI/DB reads this yet): priorityHigh,
 *     priorityHighSoft, priorityMedium, priorityMediumSoft, priorityLow, priorityLowSoft
 *   Category palette (reserved, unwired — no live UI/DB reads this yet): categoryWork,
 *     categoryWorkSoft, categoryHealth, categoryHealthSoft, categoryHome, categoryHomeSoft,
 *     categoryPersonal, categoryPersonalSoft, categoryShared, categorySharedSoft
 *
 * Also exports IDENTITY_HUES / IDENTITY_NEUTRAL — the four card-identity hues + their declared
 * badge ink, which the nine card* token names alias onto (2026-07-31, addendum A.3). See the
 * 2026-08-04 decision note above `IDENTITY_NEUTRAL` for why this stays the ONLY live
 * identity-hue system (DESIGN_COMPARISON/06 declined reviving feat* for card colour).
 *
 * Connections:
 *   Imports → —
 *   Used by → lib/useAppTheme.ts (which re-derives accentInk via contrastOn),
 *             lib/domainColor.ts (reads the card* tokens), lib/screenColor.ts (feat* tokens),
 *             lib/__tests__/colors.test.ts (the palette-wide contrast + identity-hue gate)
 *   Data    → pure constants (accentInk is re-derived downstream in useAppTheme)
 *
 * Edit notes:
 *   - `rule` is DECORATIVE ONLY and deliberately sits below the 3:1 control-boundary floor —
 *     read its doc comment on ThemePalette before using it anywhere. `border` keeps that job.
 *   - The four identity hues separate by L\*, not hue, and are mode-invariant. Never equalise
 *     their lightness — see the ⚠️ block above IDENTITY_HUES.
 *   - Adding a colour token? Add it to the matching list in lib/__tests__/colors.test.ts in
 *     the same edit — a token in no list is a token nothing checks.
 */

export type ThemeName = 'default';

/**
 * Complete palette for a single theme mode (light or dark).
 * Every token is required — TypeScript will error if any are missing.
 */
export interface ThemePalette {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  bg: string;              // Page background (darkest in dark mode, lightest in light mode)
  surface: string;         // Card / elevated surface
  surfaceMuted: string;    // Sunken / secondary surface
  surfaceInset: string;    // Inset well (deepest surface)
  /**
   * DECORATIVE HAIRLINE ONLY — the full-width notepad row dividers drawn between rows
   * (components/PadSheet.tsx / components/PadRow.tsx). Added 2026-07-31 (addendum A.1),
   * splitting the two jobs `border` was doing at one value.
   *
   * ⚠️ NEVER use `rule` for a control boundary — not an input outline, not a card edge,
   * not a chip/button border, not a focus ring, not anything that tells you where a
   * tappable thing starts or stops. Those all stay on `border`, which keeps its value
   * and its WCAG 1.4.11 ≥3:1 role. `rule` is deliberately BELOW 3:1 (1.396:1 on surface
   * in light, 1.377:1 in dark) because a ruled line that shouts is exactly the thing the
   * notepad look was meant to stop; it separates rows, it does not identify a control.
   *
   * Consequence to know before "fixing" it: `rule` is auto-EXEMPT from every contrast
   * sweep in lib/__tests__/colors.test.ts that keys off the name `border`, so nothing
   * would catch a misuse — the only guard is this comment plus the explicit `rule`
   * assertions in that test. Migrating a consumer? Ask "does this line say where a
   * control is?" — yes → `border`, no → `rule`.
   *
   * Also known and deliberate: in LIGHT mode `rule` (#D3DBE6) and `surfaceInset`
   * (#D8E1EE, nudged 2026-08-09 — was #CDD9E7) sit within ~1.06:1 of each other. That is
   * harmless because they never co-occur — an inset well draws its own recessed fill and
   * never carries row rules — so do NOT "fix" it by pushing `rule` darker; that would drag
   * it toward the ≥3:1 border band it is defined to stay out of.
   */
  rule: string;

  // ── Text ─────────────────────────────────────────────────────────────────
  text: string;            // Primary text (must be ≥ 4.5:1 contrast on bg AND surface)
  textMuted: string;       // Secondary text (must be ≥ 4.5:1 contrast on bg AND surface)
  textInverse: string;     // Text on coloured backgrounds

  // ── Borders ──────────────────────────────────────────────────────────────
  border: string;          // Primary border (lighter than surface in dark)
  borderStrong: string;    // Stronger border (lighter than border)

  // ── Accent ───────────────────────────────────────────────────────────────
  accent: string;          // Primary action / active state
  accentSoft: string;      // Accent tint for backgrounds
  accentInk: string;       // Text/icon colour on accent backgrounds

  // ── Semantic state ───────────────────────────────────────────────────────
  good: string;            // Success (chromatic)
  goodSoft: string;        // Success background
  bad: string;             // Error/destructive
  badSoft: string;         // Error background
  warn: string;            // Warning
  warnSoft: string;        // Warning background

  // ── Depth ────────────────────────────────────────────────────────────────
  shadow: string;          // Shadow colour (per-theme tint)
  overlay: string;         // Modal/sheet backdrop rgba

  // ── Hint card ────────────────────────────────────────────────────────────
  hintBg: string;          // Hint/explanation card background
  hintBorder: string;      // Hint card border
  hintAccent: string;      // Hint card accent

  // ── Feature accents (octet) ──────────────────────────────────────────────
  featTask: string;        // Task type bubble
  featPlan: string;        // Plan type bubble
  featHabit: string;       // Habit type bubble
  featShop: string;        // Shopping type bubble
  featMeal: string;        // Meal type bubble
  featBudget: string;      // Budget type bubble
  featNote: string;        // Note type bubble
  featHealth: string;      // Health type bubble
  featScan: string;        // Scan screen hue (violet) — per-screen color, no domain bubble

  // ── Card identity hues (FOUR values behind nine token names) ─────────────
  // Colours each CARD TYPE (lib/domainColor.ts), distinct from the feat* screen hues above; the
  // hue drives the CardAccent badge + header wash + the domain-coded card's edge. As of
  // 2026-07-31 (addendum A.3) there are only FOUR distinct values here — see IDENTITY_HUES
  // below for the values, the ownership map and the load-bearing L* constraint. The nine names
  // are kept so consumers keep compiling and the collapse is revertable in one edit.
  cardPlan: string;
  cardTask: string;
  cardHabit: string;
  cardHealth: string;
  cardMeal: string;
  cardShop: string;
  cardBudget: string;
  cardNote: string;
  cardScan: string;

  // ── Priority ramp (reserved — no live feature reads these yet) ────────────
  priorityHigh: string;
  priorityHighSoft: string;
  priorityMedium: string;
  priorityMediumSoft: string;
  priorityLow: string;
  priorityLowSoft: string;

  // ── Category palette (reserved — no live feature reads these yet) ────────
  categoryWork: string;
  categoryWorkSoft: string;
  categoryHealth: string;
  categoryHealthSoft: string;
  categoryHome: string;
  categoryHomeSoft: string;
  categoryPersonal: string;
  categoryPersonalSoft: string;
  categoryShared: string;
  categorySharedSoft: string;
}

export interface ThemeVariant {
  light: ThemePalette;
  dark: ThemePalette;
}

// ── Colour manipulation helpers ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [100, 100, 100];
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function relLuminance(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Calculate WCAG contrast ratio between two hex colours.
 * Returns a number ≥ 1; ≥ 4.5 is AA compliant for body text.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relLuminance(hex1);
  const l2 = relLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ── Identity hues — FOUR, collapsed from nine (2026-07-31, addendum A.3) ────
//
// The card-identity system had NINE hues (cardPlan/cardTask/cardHabit/cardHealth/cardMeal/
// cardShop/cardBudget/cardNote/cardScan — the audit found nine, not the eight the earlier
// prose assumed). Nine hues at a 22px badge is not an identity system, it's noise: nobody
// learns nine colours, and several of them only ever appeared on one screen. Collapsed to
// four, one per thing a person actually thinks of as a separate part of their life.
//
//   Hue      Value      Badge ink   Owns
//   To-do    #3F52B5    white       tasks, plans, goals
//   Habits   #218432    white       habits
//   Health   #A84A60    white       health entries, medicines, episodes
//   Shopping #D9A441    DARK        shopping, food, catalogue, budget, scan
//
// Home and Notes get NO identity hue — they are neutral (IDENTITY_NEUTRAL below).
//
// ⚠️ THE LOAD-BEARING CONSTRAINT — READ BEFORE TOUCHING ANY OF THESE FOUR VALUES:
// these four separate by **L\*** (38.6 / 48.3 / 44.3 / 70.7), not by hue. That is what makes
// them work in greyscale, in a screenshot printed in black and white, and for every form of
// colour blindness — a deuteranope cannot tell the green from the rose by hue at all, but the
// gold reads instantly as "the light one" and the other three as "the dark ones". **NEVER
// "harmonise" them to equal lightness** — an even-lightness set looks tidier in a swatch strip
// and destroys the only channel that survives colour blindness.
// Shopping consequently takes DARK ink while the other three take white. That asymmetry looks
// like an inconsistency and is not: it is the price of the L* spread, and it is correct. A
// "fix" that makes all four take white ink means Shopping was darkened, which means the spread
// is gone.
// (Honest caveat so nobody is surprised by the test: Habits 48.3 and Health 44.3 are only 4.0
// L* apart — those two separate by hue/chroma, ΔE2000 63.1. They were 0.5 apart until the
// 2026-08-04 Habits lightening below, which widened the gap without being aimed at it. The L*
// spread is what carries Shopping away from the other three and what keeps the set from
// collapsing into one grey.)
export const IDENTITY_HUES = {
  /** Tasks, plans, goals. */
  todo: { hue: '#3F52B5', ink: '#FFFFFF' },
  /** Habits. Lightened from `#1F7A2E` on 2026-08-04 — see the decision note below. */
  habits: { hue: '#218432', ink: '#FFFFFF' },
  /** Health entries, medicines, episodes. */
  health: { hue: '#A84A60', ink: '#FFFFFF' },
  /** Shopping, food, catalogue, budget, scan. Dark ink — see the constraint note above. */
  shopping: { hue: '#D9A441', ink: '#1B2432' },
} as const;

/**
 * The absence of an identity hue, for the surfaces that deliberately have none (Home, Notes).
 * A near-grey slate (C\* 8.6) — deliberately far below the four hues' chroma (41–60) so it
 * reads as "no colour assigned" rather than as a fifth, quieter identity. Mode-invariant like
 * the four hues; white ink clears AA on it (4.83:1). Do not saturate it.
 */
export const IDENTITY_NEUTRAL = '#6B7280';

// ── 2026-08-04 — "which colour system" decision (DESIGN_COMPARISON/06) ──────
// The design project's `HomeScreen.jsx` colours every card from a 9-hue `--c-feat-*` set
// (`lib/screenColor.ts`), where this app colours cards from the 4-hue `--c-card-*` set above.
// DECIDED: **keep the 4-hue card-identity system exactly as-is, everywhere (option (a)).**
// Declined (b)/(c) — moving cards fully or partly onto `feat*` — for a reason the task's own
// framing didn't have: `lib/screenColor.ts` and its entire consumption chain (the
// `ScreenColorContext` provider, `ScreenScaffold`'s `screenColor` prop, and every call site
// that used to read a `feat*` token) were already fully retired on 2026-07-31 (addendum A.5,
// *before* this task ran) — see that file's own header. It has **zero production consumers**
// today; the `feat*` tokens survive only as dormant, contrast-tested values. Reviving it to
// colour cards would be un-deleting a system that was retired for a stated, specific reason —
// "two different systems were competing for the same 2.5px bevel; the screen-hue term lost" —
// not a small plumbing step, and not this task's call to make alone. (Rule 12's "Open conflict
// #5" in `DESIGN_RULES.md`/`DESIGN_RULES_AUDIT.md` still describes `screenColor.ts` as live and
// disagreeing with `domainColor.ts` on-screen; that description is now stale and was corrected
// the same day this note was added.)
// Declined (d) — a Notes identity hue — for the same shape of reason: `cardNote` is
// `IDENTITY_NEUTRAL` on purpose (A.3: "Home and Notes get NO identity hue" — they are not one
// of the four things the collapse judged "a person actually thinks of as a separate part of
// their life"). Giving Notes a fifth hue reopens A.3's "four, not five" the same way (b)/(c)
// reopen A.5, and nobody asked for it today — the maintainer's actual complaint (below) was
// about Habits and Recurring, not Notes.
//
// **Named complaint (maintainer, 2026-08-04): "the current color scheme is not pleasing, like
// the one for recurring and habits."** Two different findings, two different-sized fixes:
//   - **Habits** (`IDENTITY_HUES.habits`) is **FIXED — `#1F7A2E` → `#218432`, shipped
//     2026-08-04.** It WAS the outlier the task flagged: darker and more saturated (L* 44.81)
//     than `todo`/`health`, and one of the four mutually-constrained, mode-invariant, CI-pinned
//     values (`lib/__tests__/colors.test.ts` asserts its exact L*, its ΔE2000 from every other
//     hue, and Shopping's ≥15 L* gap from it). The same-day task DECLINED to apply it —
//     "lightening it touches a shared system used by every card in the app and requires
//     re-pinning those exact test constants, too large a blast radius" — and recorded the
//     candidate instead. **The maintainer overruled that decline: when the design system
//     conflicts with a decision already recorded in the repo's docs, the design system wins.**
//     The blast radius turned out to be exactly what the note predicted and no more: this
//     value, `DOCUMENTED_LSTAR.habits` in `colors.test.ts`, and prose.
//     The move is a lift along the SAME hue — Lab hue angle 141.971° → 142.022°, a 0.05°
//     shift, i.e. it is the same green. **Correcting the recorded claim: chroma is NOT
//     untouched** — C* rises 54.38 → 57.87 with the lightness, which is why it doesn't read as
//     washed out; "chroma unchanged" in the original note was wrong about the number while
//     right about the effect. Re-verified numbers, all computed with `colors.test.ts`'s own
//     inline Lab/CIEDE2000 math:
//       L* 44.811 → 48.329 · C* 54.381 → 57.875 · ΔE2000(old, new) 3.55
//       white badge ink 5.410:1 → **4.761:1** on the fill and 7.021:1 → **6.478:1** on the
//         gradient's darker second stop (`#1F644E` → `#206A51`) — both still clear the 4.5/3
//         floors `colors.test.ts` checks, and `contrastOn()` still picks white, but note the
//         fill margin narrowed to 0.26 over AA. A further lightening of this hue would break
//         the declared-ink assertion; this is as bright as `#FFFFFF` ink allows.
//       ΔE2000 vs `todo` 51.04 → 52.23 · vs `health` 61.70 → 63.14 · vs `shopping` 40.23 →
//         38.69 (all ≫ the 25 floor)
//       L* gap to `shopping` (70.65) 25.84 → **22.33** (≫ the 15 floor two tests key off)
//       L* gap to `health` (44.33) 0.48 → 4.00 — a side effect, not the goal; those two still
//         separate by hue, not lightness.
//   - **Recurring** (`app/(tabs)/plans.tsx`'s `repeatingHue`) is FIXED here. It resolves through
//     `getDomainColor(theme, 'meal')` — a domain the section has no real identity in, borrowed
//     purely so it wouldn't look like Whenever's blue (see that file's inline note, pre-dating
//     A.3). Since the 2026-07-31 collapse, `cardMeal` silently aliases onto `cardShop`'s exact
//     gold (`#D9A441`) — so "Recurring" had been rendering in the literal Shopping-tab colour
//     for four days with nobody having chosen that. That's the real defect the maintainer's
//     "not pleasing" flagged, not the gold hue itself. Fixed by borrowing `health` (`#A84A60`,
//     rose) instead — the one card-identity hue nothing else on the Plans/Home screens already
//     uses, so it costs no other surface its distinctiveness, and a zero-new-token, one-file
//     change (no palette value touched, no CI-pinned constant to re-derive).
//
// Full numbers, screenshots-not-taken rationale, and the declined-options reasoning:
// `DESIGN_COMPARISON/06-which-colour-system.md` and `DESIGN_RULES_AUDIT.md`'s
// "Design-project comparison" section, item 7.

// ── Default Theme (Cool blue, Linear/Notion-clean) ──────────────────────────

const defaultLight: ThemePalette = {
  // 2026-07-18 "Soft daylight" palette (Visual Refresh Phase 01). Airy, pale, cool-blue
  // daylight mood — replaces the earlier "Vivid & clean" values. Every token name is
  // preserved (closed ThemePalette set); only values change. shadow stays a themed
  // translucent ink (not black) so depth shifts hue with the theme.
  // ── Surface ladder OPENED 2026-07-31 (addendum A.2) ──────────────────────────────────
  // The old ladder was flat to the point of invisibility: bg #EEF3F9 vs surface #FCFDFF was
  // 1.078:1, so a card had no edge of its own and every surface needed a border to exist at
  // all. Target: bg↔surface ≥ 1.20:1, and a legible step at each rung below it. Was:
  //   bg ↔ surface           1.212  (a card is visible without a border)
  //   surface ↔ surfaceMuted 1.282
  //   surfaceMuted ↔ inset   1.117
  //   rule ↔ surface         1.396  (see the `rule` doc comment — decorative, NOT a boundary)
  // ── Muted/inset lightened 2026-08-09 (user report: "boxes filled with grey are too dark") ──
  // surfaceMuted/surfaceInset back a `IconButton`/`Input`/chip fill in dozens of places
  // (quick-add option cells, disabled buttons, the medicine reminder panel, etc.) and read
  // heavier/greyer than intended. Both nudged toward `surface` (still ≥1.1 apart — the "visible
  // step" floor a few lines below this) rather than only softening `surfaceMuted` alone, which
  // would have flattened the surfaceMuted↔inset step instead of relieving it. `bg`/`surface`
  // themselves are untouched — this is the fill ladder only. Now:
  //   bg ↔ surface           1.212  (unchanged)
  //   surface ↔ surfaceMuted 1.179
  //   surfaceMuted ↔ inset   1.118
  //   rule ↔ surface         1.396  (unchanged)
  // Verified in lib/__tests__/colors.test.ts; those exact ratios are asserted there.
  bg: '#E2EAF5',
  surface: '#FFFFFF',      // at the ceiling on purpose — see the semantic-trio note below
  surfaceMuted: '#E6EDF6',
  surfaceInset: '#D8E1EE',
  rule: '#D3DBE6',         // decorative row divider ONLY — never a control boundary
  text: '#1B2432',
  textMuted: '#5F6978',    // 2026-07-31: was #5F6A79 — re-cleared 4.5:1 against the darker bg
  textInverse: '#FFFFFF',
  // 2026-07-24 contrast pass: bumped from #D3DBE6 (1.25:1 on bg, 1.37:1 on surface — invisible,
  // well under WCAG 1.4.11's 3:1 non-text minimum) to a slate-blue that clears 3:1 against both
  // bg and surface while staying in the theme's cool-blue family (contrastRatio() above verifies).
  // 2026-07-31 (A.2): nudged #7689A8 → #7284A2 to hold ≥3:1 against the darker `bg` after the
  // ladder opened (3.128:1 on bg, 3.792:1 on surface).
  border: '#7284A2',
  borderStrong: '#2B5FD9',
  // accent = Save/primary action colour. Was the card-accent DS's --color-primary #2563EB;
  // darkened a hair to #235EE0 in the 2026-07-31 ladder pass — see the note below for why the
  // four chromatic tokens had to move at all.
  accent: '#235EE0',
  accentSoft: '#CFE0FB',
  accentInk: '#FFFFFF',
  // ── Semantic trio, darkened 2026-07-30 for WCAG AA (DESIGN_RULES.md rule 10) ──────────
  // All three are used as *small text*, not just as fills — `theme.good` on MedicineTrayCard's
  // "Taken at 08:15" and ShoppingRow's in-stock meta, `theme.bad` on error/delete labels,
  // `theme.warn` on budget-over copy. At their previous values they measured 2.69 / 3.37 /
  // 3.13 against `bg` — `good` failed even the 3:1 non-text floor, and none of the three
  // cleared the 4.5:1 body-text minimum. Darkened along their own hue until each clears 4.5:1
  // against `bg` (the harder of the two backgrounds; surface is lighter and scores ~0.45 higher).
  // Same approach as the 2026-07-24 pass that raised `border` to clear 1.4.11's 3:1.
  // Dark mode was already 7-10:1 and is untouched. Verified in lib/__tests__/colors.test.ts —
  // don't lighten these back without re-running it.
  //
  // ── Why accent/good/bad/warn moved AGAIN on 2026-07-31 (the A.2 ladder pass) ──────────
  // `surface` is now #FFFFFF — its ceiling. With the top rung pinned, the only way to reach
  // bg↔surface ≥ 1.20:1 is to DARKEN `bg`, and a darker `bg` drags every chromatic token's
  // contrast against it down. With these four frozen at their 2026-07-30 values the maximum
  // reachable bg↔surface was 1.149:1 — i.e. the ladder target and the frozen tokens were
  // mutually exclusive. So the four moved instead, by ~2.5 L\* each with hue and saturation
  // bit-identical (ΔE2000 2.2–2.8, at or below the just-noticeable difference — nobody will
  // see this). Their margins IMPROVED rather than degraded: worst-case-on-bg went 4.530 →
  // 4.626. Do not "restore" the old hexes; that re-breaks the ladder.
  good: '#167651', // 2026-07-30 #177E56 → 2026-07-31 #167651 — 4.626:1 on bg
  goodSoft: '#C4EFDD',
  // bad = Delete/destructive colour. Was the DS --status-danger #EF4444, then #CA3939.
  bad: '#BE3636', // 4.594:1 on bg
  badSoft: '#FEE2E2',
  warn: '#915D16', // was #9A6217 — 4.581:1 on bg
  warnSoft: '#FBEBD3',
  shadow: 'rgba(38,58,92,0.10)',
  overlay: 'rgba(20,28,44,0.42)',
  hintBg: '#E6EEFC',
  hintBorder: '#BAD0F6',
  hintAccent: '#3B6FE0',
  // Domain accents ordered by ROUTINE SEQUENCE (2026-07-13 redesign) — color signifies
  // "the order of things," not a random rainbow. Read in the order a user moves through a day
  // (plan → task → habit → health → meal → shop → budget → note) the hue walks a deliberate
  // arc: a smooth cool gradient across the morning "get-things-done" block (indigo → blue →
  // sky → teal), then warm midday activity (orange → green), settling to money-amber and a
  // golden-yellow note accent. Health stays OFF red (it was #DC2626 === `bad`) on a calm teal.
  // (2026-07-14 "Vivid & clean" refresh: the whole octet moved to bright, confident Tailwind-
  // 500-family hues for a higher-tier look — Shopping now reads as a fresh green (#22C55E, was
  // the muddy olive-lime #65A30D) and Notes a clean golden yellow (#EAB308, was olive-lemon
  // #C9C30D). The earlier hard rule that every domain hue must sit clear of `good`(green)/
  // `bad`(red)/`warn`(gold) was RELAXED per product direction: with the app's clear button
  // layout/section structure, a green Shopping chip near a green "done" status reads fine —
  // proximity is disambiguated by placement, not hue. Status logic is UNCHANGED: good/bad/warn
  // still drive done/overdue/soon via getStatusColor; a domain accent only shows for `default`
  // rows. See lib/domainColor.ts for the mapping.)
  // (2026-08-10 "cinematic" retune: the octet moved DOWN a step, from Tailwind-500-family to
  // 600/700-family — richer and less pastel. The 500 set was tuned when these were fills; since
  // the 2026-08-05 reset they are EDGES on a white card, and a pale edge on white is barely an
  // edge: featNote #E6BC1C measured 1.81:1 against `surface`, effectively invisible. Worst case
  // is now 2.94:1 and best 6.29:1. Each screen keeps its hue FAMILY so nothing has to be
  // relearned — only the depth changed.
  //
  // ⚠️ The L* spread below is DELIBERATE and is not a tidiness bug. The proposal this came from
  // argued for "identical saturation and brightness curves"; that is the one thing the identity
  // block above forbids, for the reason stated there — equal lightness destroys the only channel
  // that survives colour blindness and greyscale. Minimum |ΔL*| between any two of the eight is
  // 10.7 here (light). Do NOT flatten these to a common lightness.
  //
  // Two picks are load-bearing and were NOT the obvious choice:
  //   · featShop is a TRUE green (#15803D), not an emerald (#059669). Emerald landed 0.2 L* from
  //     featHealth's teal — identical in greyscale, which breaks rule 11. A true green separates
  //     from teal by hue, not just lightness (ΔE 33.5 light / 21.3 dark).
  //   · featScan is #A855F7, not #8B5CF6. Against featPlan's indigo, #8B5CF6 gave ΔE 14.0;
  //     #A855F7 gives 20.8.
  // Re-measure with CIE Lab before changing any value here; every one clears contrastOn() ≥3:1.)
  featPlan: '#4F46E5',   // 1 · indigo   — plan the day
  featTask: '#2563EB',   // 2 · blue     — do tasks
  featHabit: '#0284C7',  // 3 · sky      — keep habits
  featHealth: '#0D9488', // 4 · teal     — track health (off red/`bad`)
  featMeal: '#EA580C',   // 5 · orange   — eat (2026-07-18: muted off neon #F5843A, less candy)
  featShop: '#15803D',   // 6 · green    — shop (2026-07-18: muted off neon #34C06A, less candy;
  // 2026-08-10: emerald → true green, see the greyscale note above)
  featBudget: '#D97706', // 7 · amber    — money (2026-07-20: deepened/desaturated off the
  // brighter #F0A81E — that shade read as too loud/candy next to the tab bar's new neutral
  // blue selection accent; same hue family, calmer). Unwired — no screen maps to it.
  featNote: '#CA8A04',   // 8 · yellow   — reflect / note
  // Scan screen hue — violet, distinct from featPlan indigo. Per-screen color only
  // (Scan has no domain bubble); read via lib/screenColor.ts (2026-07-18).
  featScan: '#A855F7',

  // ── Card identity: NINE NAMES, FOUR VALUES (2026-07-31, addendum A.3) ────────────────
  // Superseded the 2026-07-28 nine-hue "widened ramp". That pass fixed the wrong problem: the
  // ramp was widened so nine badges could be told apart, when the real issue was that nine
  // identities is more than anyone learns. The values now come from IDENTITY_HUES above —
  // read the ⚠️ L\* constraint there before changing any of them.
  //
  // The mapping, stated once (this is what a consumer-migration should follow):
  //   cardPlan   → todo     (plans)
  //   cardTask   → todo     (tasks; goals ride the same hue, they have no card* token)
  //   cardHabit  → habits
  //   cardHealth → health   (health entries, medicines, episodes)
  //   cardShop   → shopping
  //   cardMeal   → shopping (food/recipes are part of the shopping world)
  //   cardBudget → shopping (already dead per the audit — nothing reads it)
  //   cardScan   → shopping (already dead per the audit — nothing reads it)
  //   cardNote   → NEUTRAL  (Notes gets no identity hue; Home likewise, it has no token)
  //
  // The five retired names are kept as ALIASES rather than deleted, deliberately: consumers
  // (lib/domainColor.ts's DOMAIN_TOKEN, and every screen behind it) keep compiling untouched,
  // a later consumer-migration pass can retire them one at a time, and backing the whole
  // collapse out is a one-commit revert of this block. Do not delete a name here before its
  // consumers are gone.
  //
  // Identity hues are MODE-INVARIANT now — the dark palette repeats these same four values
  // instead of lightening each one ~0.20 the way the old ramp did. Lightening per mode would
  // change the L\* gaps per mode, and the L\* spread is precisely the thing that has to hold.
  cardPlan: IDENTITY_HUES.todo.hue,
  cardTask: IDENTITY_HUES.todo.hue,
  cardHabit: IDENTITY_HUES.habits.hue,
  cardHealth: IDENTITY_HUES.health.hue,
  cardMeal: IDENTITY_HUES.shopping.hue,
  cardShop: IDENTITY_HUES.shopping.hue,
  cardBudget: IDENTITY_HUES.shopping.hue,
  cardNote: IDENTITY_NEUTRAL,
  cardScan: IDENTITY_HUES.shopping.hue,

  // Reserved priority/category ramps from the 2026-07-14 Claude Design brief — no live
  // feature reads these yet (dormant `priority` SQLite column, unwired category concept).
  priorityHigh: '#C4341F',
  priorityHighSoft: '#FBEAE8',
  priorityMedium: '#B7691A',
  priorityMediumSoft: '#FDF1E1',
  priorityLow: '#5B6472',
  priorityLowSoft: '#EEF1F4',

  categoryWork: '#2854C9',
  categoryWorkSoft: '#EFF3FF',
  categoryHealth: '#0F8B63',
  categoryHealthSoft: '#ECF9F5',
  categoryHome: '#A9631E',
  categoryHomeSoft: '#FBF1E8',
  categoryPersonal: '#7A4FC9',
  categoryPersonalSoft: '#F3EEFC',
  categoryShared: '#B23E82',
  categorySharedSoft: '#FBEAF3',
};

const defaultDark: ThemePalette = {
  // 2026-07-18 "Midnight glass" palette (Visual Refresh Phase 01). Deep-navy, low-glare
  // night mood pairing with Soft daylight above. Every token name is preserved; only
  // values change. shadow stays a themed translucent ink (not black) so depth shifts hue
  // with the theme.
  // ── Surface ladder OPENED 2026-07-31 (addendum A.2), mirroring the light block ────────
  //   bg ↔ surface           1.277
  //   surface ↔ surfaceMuted 1.112
  //   surfaceMuted ↔ inset   1.113
  //   rule ↔ surface         1.377  (decorative row divider ONLY — see the `rule` doc comment)
  // ── surfaceMuted nudged lighter 2026-08-09 (same report as the light block above) ──────
  // Dark mode has almost no headroom here: surface↔surfaceMuted was already 1.112, a hair
  // above the 1.1 "visible step" floor a few lines below, so this is the lightest surfaceMuted
  // can go without that step vanishing (a few RGB units — expect this to read as a small, not
  // dramatic, change versus the light-mode fix). Getting materially further would mean moving
  // `surface`/`bg` themselves, which this pass deliberately does not do. Now:
  //   surface ↔ surfaceMuted 1.100
  //   surfaceMuted ↔ inset   1.125
  bg: '#080A11',
  surface: '#1B2438',
  surfaceMuted: '#161C29',
  surfaceInset: '#0B0F18',
  rule: '#303B50',
  // 2026-07-31: was #E9EDF5, which measured 12.5:1 on `surface` — over the halation cap. Pure
  // near-white body text on a dark surface blooms/smears for a lot of readers (astigmatism
  // especially), and it is the single most common dark-mode legibility complaint. Now 9.507:1
  // on surface, inside the 7–12 band lib/__tests__/colors.test.ts asserts. The upper bound
  // there is a REAL requirement, not a leftover — don't "improve" this back toward white.
  text: '#C7CBD1',
  textMuted: '#8B95A7',
  textInverse: '#080B12',
  // 2026-07-24 contrast pass: bumped from #2A3346 (1.56:1 on bg — invisible) and #3C4B66
  // (2.24:1 — still under WCAG 1.4.11's 3:1 non-text minimum) to lighter slate-blues that
  // clear 3:1 against both bg and surface, mirroring the light-theme border bump above.
  // 2026-07-31 (A.2): nudged #5B6C8A → #5F7090 to hold ≥3:1 against the lightened `surface`
  // (3.102:1 on surface, 3.962:1 on bg).
  border: '#5F7090',
  borderStrong: '#7891B6',
  accent: '#6EA8FF',
  accentSoft: '#1B2C49',
  accentInk: '#080B12',
  good: '#34D399',
  goodSoft: '#123227',
  bad: '#FB7185',
  badSoft: '#3A1620',
  warn: '#F0B24A',
  warnSoft: '#33240F',
  shadow: 'rgba(0,2,10,0.65)',
  overlay: 'rgba(0,0,0,0.62)',
  hintBg: '#141E30',
  hintBorder: '#28405F',
  hintAccent: '#6EA8FF',
  // Dark mirrors the light "Vivid & clean" arc (2026-07-14): same hue families, brighter
  // tints for the dark surface. Order plan → task → habit → health → meal → shop → budget →
  // note; health = teal (off red/`bad`). See the light block above for the full rationale
  // (bright Tailwind-family hues, collision-avoidance relaxed) and lib/domainColor.ts.
  // (2026-08-10: dark mirrors of the light "cinematic" retune above — each is its light value
  // lifted toward white by a per-hue amount, NOT a uniform lift. A uniform lift compressed the
  // set into L* 60–72 and put featShop 8.5 ΔE from featHealth; the per-hue lifts hold the spread
  // at L* 55.5–73.1 with the closest pair at ΔE 17.0, matching what the old set managed (17.5).
  // Every value clears 3:1 against `surface` — worst is featPlan at 4.18:1 — and note
  // computeBorderRamp lightens these AGAIN at render in dark mode, so they are the floor, not
  // the drawn colour.)
  featPlan: '#7D76EC',   // 1 · indigo
  featTask: '#5988F0',   // 2 · blue
  featHabit: '#4EA9D8',  // 3 · sky
  featHealth: '#51B2A9', // 4 · teal
  featMeal: '#EF8046',   // 5 · orange (2026-07-18: muted off neon #FF9A55)
  featShop: '#60A97B',   // 6 · green  (2026-07-18: muted off neon #45D588)
  featBudget: '#E49D4C', // 7 · amber (2026-07-20: deepened/desaturated off #FBBF3C, dark mirror
  // of the light-mode change above — same reasoning, less neon against the blue tab bar)
  featNote: '#DAAD4F',   // 8 · yellow
  // Scan screen hue — violet (per-screen color only; see lib/screenColor.ts, 2026-07-18).
  featScan: '#B977F9',

  // Card identity (dark) — IDENTICAL to light as of 2026-07-31 (addendum A.3). The old ramp
  // lightened every stop ~0.20 for the dark surface; the four collapsed hues do NOT, because
  // their separation is carried by the L\* gaps (see IDENTITY_HUES) and lightening per mode
  // would give dark mode a different set of gaps than light. Same nine-name → four-value
  // aliasing as the light block; the mapping table lives there, stated once.
  cardPlan: IDENTITY_HUES.todo.hue,
  cardTask: IDENTITY_HUES.todo.hue,
  cardHabit: IDENTITY_HUES.habits.hue,
  cardHealth: IDENTITY_HUES.health.hue,
  cardMeal: IDENTITY_HUES.shopping.hue,
  cardShop: IDENTITY_HUES.shopping.hue,
  cardBudget: IDENTITY_HUES.shopping.hue,
  cardNote: IDENTITY_NEUTRAL,
  cardScan: IDENTITY_HUES.shopping.hue,

  // Reserved priority/category ramps — dark values from the 2026-07-14 Claude Design brief.
  priorityHigh: '#F0685A',
  priorityHighSoft: '#2A0F0D',
  priorityMedium: '#E0A030',
  priorityMediumSoft: '#2A2010',
  priorityLow: '#8A93A0',
  priorityLowSoft: '#171C24',

  categoryWork: '#6E9CF5',
  categoryWorkSoft: '#101B33',
  categoryHealth: '#34C99A',
  categoryHealthSoft: '#0B241C',
  categoryHome: '#E0A050',
  categoryHomeSoft: '#2A2013',
  categoryPersonal: '#B197F0',
  categoryPersonalSoft: '#201A33',
  categoryShared: '#E870B0',
  categorySharedSoft: '#2E1522',
};

// ── Theme registry ───────────────────────────────────────────────────────────

export const THEMES: Record<ThemeName, ThemeVariant> = {
  default: { light: defaultLight, dark: defaultDark },
};

/**
 * Resolve a theme palette for the given theme name and mode.
 * Returns the light palette for the theme, or dark if isDark is true.
 */
export function getThemePalette(themeName: ThemeName, isDark: boolean): ThemePalette {
  const variant = THEMES[themeName];
  if (!variant) {
    return THEMES.default[isDark ? 'dark' : 'light'];
  }
  return isDark ? variant.dark : variant.light;
}
