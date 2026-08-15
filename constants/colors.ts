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
 *   Feature accents (per-screen hues — lib/screenColor.ts, REVIVED and live since the
 *     2026-08-05 card reset; they are the ONLY thing that colours a card/field/button EDGE.
 *     This line said "RETIRED 2026-07-31 addendum A.5, zero production consumers" until
 *     2026-08-10 — it had been stale for five days): featTask, featPlan,
 *     featHabit, featShop, featMeal, featBudget, featNote, featHealth, featScan
 *   Card identity hues (lib/domainColor.ts, drives the card badge + the pane's 5% wash —
 *     COLLAPSED from nine hues to FOUR on 2026-07-31 (addendum A.3), then RETUNED to FIVE
 *     neon categoricals on 2026-08-16 (maintainer brief §7, which also gave Notes a hue of
 *     its own); the nine token names all still exist and alias five values, see the card
 *     block below): cardTask, cardPlan, cardHabit,
 *     cardShop, cardMeal, cardBudget, cardNote, cardHealth, cardScan
 *   Priority ramp (reserved, unwired — no live UI/DB reads this yet): priorityHigh,
 *     priorityHighSoft, priorityMedium, priorityMediumSoft, priorityLow, priorityLowSoft
 *   Category palette (reserved, unwired — no live UI/DB reads this yet): categoryWork,
 *     categoryWorkSoft, categoryHealth, categoryHealthSoft, categoryHome, categoryHomeSoft,
 *     categoryPersonal, categoryPersonalSoft, categoryShared, categorySharedSoft
 *
 * Also exports IDENTITY_HUES / IDENTITY_NEUTRAL — the five card-identity hues + their declared
 * badge ink, which the nine card* token names alias onto. See the 2026-08-04 decision note
 * above `IDENTITY_NEUTRAL` for why this stays the ONLY live identity-hue system for CARDS
 * (DESIGN_COMPARISON/06 declined reviving feat* for card colour); the dark `feat*` octet is
 * aligned to the same five categoricals as of 2026-08-16 so a screen's 5% pane wash and its
 * badges agree, which is a different job, not a second system.
 *
 * Connections:
 *   Imports → constants/theme.ts (relLuminance only — the WCAG maths behind contrastRatio;
 *             this file held a byte-identical private copy of it, plus of hexToRgb, until
 *             2026-08-12. theme.ts imports nothing, so the edge is one-directional.)
 *   Used by → lib/useAppTheme.ts (which re-derives accentInk via contrastOn),
 *             lib/domainColor.ts (reads the card* tokens), lib/screenColor.ts (feat* tokens),
 *             lib/__tests__/colors.test.ts (the palette-wide contrast + identity-hue gate)
 *   Data    → pure constants (accentInk is re-derived downstream in useAppTheme)
 *
 * Edit notes:
 *   - `rule` is DECORATIVE ONLY and deliberately sits below the 3:1 control-boundary floor —
 *     read its doc comment on ThemePalette before using it anywhere. `border` keeps that job.
 *   - The five identity hues are mode-invariant and separate by HUE (ΔE2000 ≥ 25 pairwise).
 *     They used to separate by L\* instead; that guarantee was dropped on instruction in the
 *     2026-08-16 neon pass — read the ⚠️ block above IDENTITY_HUES before restoring it.
 *   - Adding a colour token? Add it to the matching list in lib/__tests__/colors.test.ts in
 *     the same edit — a token in no list is a token nothing checks.
 */
import { relLuminance } from '@/constants/theme';

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

  // ── Glass (Tactile Glass, 2026-08-15) ────────────────────────────────────
  /**
   * The pane's REAL translucent fill — what `components/Surface.tsx` actually paints.
   * `surface` above is the same colour already COMPOSITED over the backdrop, and that
   * split is the whole reason WCAG stays testable under translucency: every contrast
   * assertion in lib/__tests__/colors.test.ts keeps measuring an opaque hex, and it is
   * a hex the compositor really produces, because the ground behind a card is known.
   *
   * ⚠️ The two must agree. Dark: `rgba(255,255,255,0.118)` over `#000000` composites to
   * exactly `#1E1E1E`, which is why the dark palette did not move at all in this pass.
   * Light: `rgba(255,255,255,0.78)` over the backdrop's DARKEST stop (`#e4ecfb` in
   * components/ScreenBackground.tsx) gives `#F9FBFE` — worst case, so the real pane is
   * never darker than the value the tests check. Change one, re-derive the other; the
   * test asserts the composite, so they cannot silently drift apart.
   *
   * ⚠️ The dark alpha is set by the HALATION CEILING, not by taste. The brief asked for
   * 5–10% white; at 7% the pane is `#121212` and `text` measures 17.0:1 on it, over the
   * 16:1 ceiling DESIGN_RULES.md rule 10a defends (near-white text on a dark surface
   * blooms for astigmatic readers). 11.8% is the lowest alpha that stays inside it.
   */
  surfaceGlass: string;
  /**
   * The overlay/nav tier — sheets, modals, the floating header, the bottom nav. Brighter
   * (more tint, less transparent) so a surface that floats ABOVE content reads as raised.
   * These are also the only places that mount a real `BlurView`: they are the only ones
   * with content behind them worth blurring. See components/Surface.tsx's `surfaceContext`.
   */
  surfaceGlassStrong: string;

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

/**
 * Calculate WCAG contrast ratio between two hex colours.
 * Returns a number ≥ 1; ≥ 4.5 is AA compliant for body text.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relLuminance(hex1);
  const l2 = relLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ── Identity hues — FIVE neon categoricals (2026-08-16, maintainer brief §7) ─
//
// History, because this table has been rewritten twice and the reasons matter:
// the system had NINE hues until 2026-07-31 (addendum A.3), which collapsed it to FOUR on the
// grounds that nobody learns nine colours at a 22px badge. The collapse stands — this is still
// "one hue per thing a person thinks of as a separate part of their life" — but the VALUES and
// the count are the maintainer's 2026-08-16 categorical brief, which named each one by hand
// and added Notes as a real identity rather than a neutral:
//
//   Hue      Value      Badge ink   Owns
//   To-do    #FFC000    DARK        tasks, plans, goals            (neon amber)
//   Habits   #05D9E8    DARK        habits                         (electric cyan)
//   Health   #FF2A6D    DARK        health entries, medicines, episodes (neon rose)
//   Shopping #00FF85    DARK        shopping, food, catalogue, budget, scan (neon green)
//   Notes    #B967FF    DARK        notes                          (amethyst)
//
// Home still gets NO identity hue (IDENTITY_NEUTRAL below); Notes no longer shares that fate.
//
// ⚠️ **THE L\* SPREAD IS GONE, DELIBERATELY, AND THIS IS THE ONE THING TO READ BEFORE EDITING.**
// The four-hue set separated by **L\*** (38.6 / 48.3 / 44.3 / 70.7) rather than by hue, and the
// note that stood here said in capitals never to harmonise them, because lightness is the only
// channel that survives greyscale and colour blindness. That is still TRUE as colour science.
// It was **overridden on the maintainer's explicit instruction** (2026-08-16), asked and
// answered as a direct trade — "full neon, drop the greyscale guarantee" — in service of the
// OLED brief: a set spread across L\* 38–71 contains, by construction, three hues too dark to
// glow against pure black, which is the entire look being asked for. So these five sit at
// L\* 56–90 and separate by **hue and chroma** instead: every pair is ΔE2000 ≥ 25 (worst is
// Habits/Shopping at 32.7), and that pairwise floor is now the ONLY separation guarantee.
// Consequences, so nobody is surprised:
//   · A deuteranope cannot reliably tell Habits' cyan from Shopping's green. Accepted.
//   · A greyscale screenshot flattens To-do/Habits/Shopping (L\* 81/79/89) into one band.
//   · `lib/__tests__/colors.test.ts` no longer asserts a per-hue L\* pin or Shopping's ≥15 L\*
//     gap; it asserts the ΔE2000 floor. Both changes are recorded there with this reasoning.
// **This is the guarantee that pays for it**: the badge GLYPH is contrast-checked per hue, per
// mode, against the real composited plate (`badgeGlyphFor`, `lib/domainColor.ts`), so no hue
// is ever drawn somewhere its legibility is merely assumed. If you are tempted to restore the
// L\* spread, that is a maintainer conversation, not a tidy-up — it un-picks the brief.
//
// All five take DARK ink, which is not the old asymmetry returning inverted: they are all
// bright now, so `contrastOn()` picks the dark end for every one of them. That uniformity is a
// symptom of the neon set, not a separate decision.
export const IDENTITY_HUES = {
  /** Tasks, plans, goals. Neon amber. */
  todo: { hue: '#FFC000', ink: '#1B2432' },
  /** Habits. Electric cyan. */
  habits: { hue: '#05D9E8', ink: '#1B2432' },
  /** Health entries, medicines, episodes. Neon rose. */
  health: { hue: '#FF2A6D', ink: '#1B2432' },
  /**
   * Shopping, food, catalogue, budget, scan. Neon green.
   *
   * The brief offered `#01FFC3` "or bright neon green". `#01FFC3` was measured against Habits'
   * electric cyan at **ΔE2000 22.9** — under the 25 separation floor, and visibly so: two
   * cyan-greens one tab apart in the nav. `#00FF85` is the same mint-emerald idea rotated far
   * enough toward green to clear it at 32.7. Don't rotate it back.
   */
  shopping: { hue: '#00FF85', ink: '#1B2432' },
  /** Notes. Amethyst. New in 2026-08-16 — Notes was IDENTITY_NEUTRAL before this. */
  notes: { hue: '#B967FF', ink: '#1B2432' },
} as const;

/**
 * The absence of an identity hue, for the surfaces that deliberately have none.
 *
 * ⚠️ **Notes LEFT this on 2026-08-16** — the categorical brief gave it amethyst. Home is the
 * only holdout now, and Home has no `card*` token at all, so this constant currently has no
 * palette consumer. It is kept (and still contrast-tested) because "no colour assigned" is a
 * state the system should be able to express, and because reviving it is a one-line change.
 * A near-grey slate (C\* 8.6) — deliberately far below the five hues' chroma (43–87) so it
 * reads as absence rather than as a sixth, quieter identity. Do not saturate it.
 */
export const IDENTITY_NEUTRAL = '#6B7280';

// ── 2026-08-04 — "which colour system" decision (DESIGN_COMPARISON/06) ──────
// ⚠️ **HISTORY, NOT CURRENT STATE, on two counts (both superseded 2026-08-16).** Kept because
// the reasoning below is still the reason there is ONE card-identity system rather than two,
// which does still hold — but its two headline conclusions have since been overruled by the
// maintainer's categorical brief: the set is FIVE hues, not four, and Notes now HAS an identity
// hue (option (d), declined here, was effectively granted). The dark `feat*` octet is also
// aligned onto those five now, which is not the same as "reviving feat* for card colour" — the
// two systems still have separate jobs (screen wash vs card badge); they simply agree on the
// values in dark mode. Read IDENTITY_HUES' block above for what is true today.
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
  // ── Tactile Glass, 2026-08-15: `surface` is now a COMPOSITE, and `bg` did not move ──────
  // `surface` was `#FFFFFF` — "at the ceiling on purpose". A translucent pane cannot reach
  // the ceiling, so it drops to `#F9FBFE` (`surfaceGlass` over the backdrop's darkest stop)
  // and the bg↔surface step goes 1.212 → 1.170.
  //
  // ⚠️ DO NOT "fix" that by darkening `bg`. It was measured: at `#DCE5F3` the step is back to
  // 1.212 and SIX tokens fail 4.5:1 at once (textMuted, accent, good, bad, warn, borderStrong,
  // with `border` dropping under 3:1 too). That is exactly what the 2026-07-31 note below
  // predicted — "the ladder target and the frozen tokens were mutually exclusive" — and it is
  // still true; translucency only tightened it. The relaxation is recorded as DESIGN_RULES.md
  // rule 10b, and it is a trade, not a loss: the card boundary MOVED from the fill step to the
  // edge, where `getGlassEdge()`'s shade stop is plain `border` at 3.658:1 on the pane and
  // 3.128:1 on bg. A measured 3:1 boundary is a stronger promise than a 1.21 fill step was.
  // Every text and chromatic token is untouched and still clears 4.5:1 on both rungs.
  bg: '#E2EAF5',
  surface: '#F9FBFE',      // = surfaceGlass composited over the backdrop's darkest stop
  surfaceMuted: '#E6EDF6',
  surfaceInset: '#D8E1EE',
  rule: '#D3DBE6',         // decorative row divider ONLY — never a control boundary
  surfaceGlass: 'rgba(255,255,255,0.78)',
  surfaceGlassStrong: 'rgba(255,255,255,0.88)',
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
  //   cardNote   → notes    (amethyst — was NEUTRAL until the 2026-08-16 categorical brief;
  //                          Home still has no identity hue, and no token either)
  //
  // The four retired names are kept as ALIASES rather than deleted, deliberately: consumers
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
  cardNote: IDENTITY_HUES.notes.hue,
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
  // ── "True black" palette, 2026-08-10 ────────────────────────────────────────────────────
  // Replaces the 2026-07-18 "Midnight glass" deep-navy set, on the maintainer's instruction
  // after an outside design review: pure black leverages OLED hardware (an unlit pixel draws
  // no power and gives infinite local contrast), and the neutral greys that go with it drop
  // the navy cast the whole dark mode used to carry. Every token NAME is preserved; only
  // values change, and only in this block — the light palette is untouched, deliberately.
  //
  // The review supplied three surface values (background #000000, card #121212, elevated
  // #1E1E1E) for a ladder that has four rungs here. They map as below, with only the deepest
  // well invented. `surface` takes the ELEVATED value rather than the card one because it is
  // the only assignment where a card still reads as raised off a pure-black page
  // (bg↔surface 1.260 vs 1.121 — the ≥1.20 floor in colors.test.ts) and it spends both
  // supplied hexes instead of discarding one.
  //
  // ── Surface ladder, and where it had to give ────────────────────────────────────────────
  //   bg ↔ surface           1.260   (floor ≥1.20 — holds)
  //   surface ↔ surfaceMuted 1.124   (floor ≥1.10 — holds)
  //   surfaceMuted ↔ inset   1.057   (floor RELAXED to ≥1.05 — see below)
  //   rule ↔ surface         1.119   (band RELAXED to ≥1.10 — see below)
  // ⚠️ The bottom of the ladder is arithmetic, not taste. A pure-black `bg` leaves ~0.006 of
  // relative luminance for two rungs beneath `surface`; there is no pair of hexes that keeps
  // a 1.10 step at both. If you want the 1.10 floor back, `bg` has to leave black — that is
  // the trade, and it is the one thing this palette exists to avoid.
  bg: '#000000',
  surface: '#1E1E1E',
  surfaceMuted: '#121212',
  surfaceInset: '#0A0A0A',
  // ── Tactile Glass, 2026-08-15 ───────────────────────────────────────────────────────────
  // `rgba(255,255,255,0.118)` over a `#000000` ground composites to EXACTLY `#1E1E1E` — the
  // value `surface` already had — which is why not one number in this dark block moved when
  // the app went translucent, and why every dark assertion in colors.test.ts still passes
  // unedited. The ground really is pure black: ScreenBackground's DARK.base is three
  // `#000000` stops with both radial glows at opacity 0, and its branch art is edge-anchored
  // with the centre box (where cards live) kept clear by design.
  //
  // ⚠️ 0.118, not the brief's "5% to 10%", and the reason is the halation ceiling rather than
  // taste — at 0.07 the pane is `#121212` and `text` measures 17.0:1 on it, past the 16:1
  // bound rule 10a defends. Lowering this alpha makes the app LESS legible, not airier.
  surfaceGlass: 'rgba(255,255,255,0.118)',
  surfaceGlassStrong: 'rgba(255,255,255,0.16)',   // -> #292929, the overlay/nav tier
  // Supplied as "border.subtle". It is a DIVIDER weight, not a control boundary — 1.119:1 on
  // `surface`, nowhere near WCAG 1.4.11's 3:1 — so it lands on `rule`, which is exactly the
  // token this codebase split out for decorative hairlines, and NOT on `border`. Using it as
  // a card/input/chip edge would erase the border-as-grouping-signal system the 2026-08-05
  // card reset is built on. See `border` below for the value that does that job.
  rule: '#27272A',
  // ⚠️ PURE WHITE, 16.67:1 on `surface` — outside the old 7–12 halation band, and now outside
  // the 16 ceiling that replaced it too. Both moves were by instruction, one after the other:
  // 2026-08-10 raised the ceiling 12 → 16 for the true-black palette's `#F3F4F6`, and
  // 2026-08-16's brief §5 requires "Primary text (Headers, main tasks) must be pure white
  // (#FFFFFF)", which needs 17. The original reasoning has still never been shown to be wrong —
  // near-white text on a dark surface blooms for astigmatic readers, and it is the most common
  // dark-mode legibility complaint there is. If one ever comes back from a real device, THIS is
  // the token to pull back first (toward ~#D8DADF), before touching any surface value.
  text: '#FFFFFF',
  // Brief §5: "Secondary text (dates, placeholders) must be a highly legible silver/grey
  // (rgba(255,255,255,0.6))". A literal 60% white over `surface` composites to `#8E8E8E`, which
  // lands at 4.99:1 — legible, but the brief's own word is "highly", and a flat neutral next to
  // a pure-white primary reads as dirty rather than as silver. `#A1A1AA` is that value opened up
  // to 6.50:1 on `surface` / 8.19:1 on `bg`, with a faint cool cast so it belongs to the same
  // family as the white above it. Do not take it below ~#8E8E8E; that is the AA cliff.
  textMuted: '#A1A1AA',
  textInverse: '#0A0A0A',
  // NOT the supplied #27272A (1.41:1 on bg, 1.26:1 on surface — an invisible control edge).
  // Derived instead to clear WCAG 1.4.11's 3:1 on every rung it is ever drawn against:
  // 4.808:1 on bg, 3.817:1 on surface, 4.289:1 on surfaceMuted. Neutral rather than the old
  // slate-blue #5F7090, to match the greyed-out surfaces above.
  border: '#787882',
  borderStrong: '#9A9AA5',
  // ── Vibrant pass, 2026-08-16 (brief §4: "highly saturated, vibrant jewel tones") ──────────
  // Dark mode only — light keeps its own accessible values, which are constrained by a pale
  // background these hues cannot survive.
  //
  // ⚠️ `accent` is ELECTRIC BLUE and deliberately not cyan, even though the brief lists "Neon
  // Cyan" first. Cyan is spoken for: brief §7 assigns `#05D9E8` to Habits as a CATEGORY colour,
  // and an accent that matches one category's identity makes every primary button on every
  // other screen look like it belongs to Habits. Blue is the one vivid slot the five
  // categoricals leave open (nearest is Habits' cyan at ΔE2000 30.5).
  // 4.78:1 on `surface` (was 4.53), so this also retires the 4.4 floor's last excuse — see
  // `bad` below. contrastOn() still picks the dark ink, so nothing on an accent fill flipped.
  accent: '#1E88FF',
  accentSoft: '#12233D',
  accentInk: '#0A0A0A',
  // Bright emerald, per the brief's named example. 9.98:1 on `surface`.
  good: '#00E58A',
  goodSoft: '#0B2A20',
  // ⚠️ Retuned off `#EF4444`, and that FIXES a documented shortfall rather than creating one:
  // #EF4444 measured 4.430:1 on `surface` — 0.07 under AA — and was kept on instruction in the
  // 2026-08-10 pass, which is the sole reason `CHROMATIC_FLOOR.dark` in colors.test.ts was
  // relaxed to 4.4. This is 4.79:1, so that floor goes back to 4.5 in the same change.
  bad: '#FF3B5C',
  badSoft: '#2E1215',
  warn: '#FFB300',
  warnSoft: '#2D2109',
  // Neutral now, not navy-tinted — a blue-black shadow over a true-black page reads as a
  // colour cast on the one surface that is supposed to have none.
  shadow: 'rgba(0,0,0,0.72)',
  overlay: 'rgba(0,0,0,0.68)',
  hintBg: '#101826',
  hintBorder: '#22304A',
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
  // ── ALIGNED TO THE FIVE CATEGORICALS, 2026-08-16 (brief §7) ─────────────────────────────
  // The dark octet no longer mirrors light's routine-sequence arc. It can't: `feat*` is what
  // `lib/screenColor.ts` resolves for a screen's 5% pane wash, and `card*` is what the badge
  // on that same pane draws — so a teal Health wash under a neon-rose Health badge is one
  // screen wearing two identities. The brief's "distinct visual identity for each section"
  // means those two agree, so the five named categoricals are repeated here verbatim.
  //
  // ⚠️ **LIGHT MODE IS DELIBERATELY NOT TOUCHED.** Its octet is the 2026-08-10 "cinematic"
  // set, tuned for legibility against a pale card; these neons measure 1.1–1.5:1 there. Light
  // is the accessibility path now (see the dark-default note in store/useSettingsStore.ts),
  // and making it worse to make it consistent is the wrong trade. The consequence — light mode
  // has a teal Health wash under a rose Health badge — is known and accepted.
  //
  // Three of the nine are NOT one of the five named categories and are picked to stay clear of
  // all of them rather than to mean anything new:
  featPlan: '#FFC000',   // goals — rides To-do's amber (this token has no live consumer; see
  // lib/screenColor.ts's SCREEN_TOKEN note on `goals`)
  featTask: '#FFC000',   // the to-do list — neon amber
  featHabit: '#05D9E8',  // habits — electric cyan
  featHealth: '#FF2A6D', // health — neon rose
  featMeal: '#FF7A1A',   // food & meals — neon orange. Part of the shopping world, but its own
  // screen, so it can't just take Shopping's green; orange is the nearest free slot.
  featShop: '#00FF85',   // shopping — neon green
  featBudget: '#FFB300', // money — unwired, no screen maps to it
  featNote: '#B967FF',   // notes — amethyst
  featScan: '#7C5CFF',   // scan & receipts — electric indigo. It was violet, which amethyst
  // now owns; moved along the hue wheel rather than being left to collide with Notes.

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
  cardNote: IDENTITY_HUES.notes.hue,
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
