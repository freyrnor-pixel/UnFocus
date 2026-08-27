/**
 * colors.test.ts — Tests for Decision 006 colour theme token layer
 *
 * Verifies:
 * (a) Default theme exposes the full token set in both light and dark modes
 * (b) WCAG AA contrast compliance: text and textMuted ≥ 4.5:1 against both bg and surface
 * (c) Dark-mode depth ordering: border > surface > bg (lighter values)
 * (d) DESIGN_RULES.md rule 10 sweep (2026-07-30): the semantic trio as small text, the
 *     structural non-text tokens, soft-background/ink pairs, and every `feat`/`card` identity
 *     hue used as a badge fill under contrastOn(). This is the "add your new colour token
 *     here in the same edit" gate — a token that isn't in one of these lists isn't checked.
 * (e) The 2026-07-31 addendum gate (A.6): the surface ladder's minimum steps, the `rule`
 *     decorative-hairline band, the dark body-text HALATION CAP (a maximum, not just a
 *     minimum), identity-badge ink at AA, and the identity-hue separation + L* drift guards.
 *     WCAG contrast, CIE L* and CIEDE2000 are implemented inline below — no new dependency.
 */

import {
  THEMES,
  ThemeName,
  contrastRatio,
  getThemePalette,
  IDENTITY_HUES,
  IDENTITY_NEUTRAL,
} from '@/constants/colors';
import { readFileSync } from 'fs';
import { join } from 'path';
import { contrastOn, getBadgeFrost } from '@/constants/theme';
import { getDomainColor, badgeGlyphFor, Domain } from '@/lib/domainColor';

const THEME_NAMES: ThemeName[] = ['default'];

const REQUIRED_TOKENS = [
  'bg', 'surface', 'surfaceMuted', 'surfaceInset', 'rule',
  // Tactile Glass, 2026-08-15. These three are rgba() strings, not hexes — they are what is
  // actually painted, while `surface` is the same colour already composited over the backdrop.
  // The completeness sweep below only checks presence, and the contrast sweeps deliberately
  // skip them: you cannot measure a contrast ratio against a translucent colour, which is
  // exactly why the composite is a separate token. __tests__/glassMaterial.test.ts is what
  // asserts the two still agree.
  'surfaceGlass', 'surfaceGlassStrong',
  'text', 'textMuted', 'textInverse',
  'border', 'borderStrong',
  'accent', 'accentSoft', 'accentInk',
  'good', 'goodSoft', 'bad', 'badSoft', 'warn', 'warnSoft',
  'shadow', 'overlay',
  'hintBg', 'hintBorder', 'hintAccent',
  'featTask', 'featPlan', 'featHabit', 'featShop', 'featMeal', 'featBudget', 'featNote', 'featHealth', 'featScan',
  'cardPlan', 'cardTask', 'cardHabit', 'cardHealth', 'cardMeal', 'cardShop', 'cardBudget', 'cardNote', 'cardScan',
] as const;

describe('Decision 006 — Colour Theme Token Layer', () => {
  describe('(a) Token completeness', () => {
    THEME_NAMES.forEach((themeName) => {
      describe(themeName, () => {
        const variant = THEMES[themeName];

        test(`light mode has all ${REQUIRED_TOKENS.length} required tokens`, () => {
          const palette = variant.light;
          REQUIRED_TOKENS.forEach((token) => {
            expect(palette[token]).toBeDefined();
            expect(typeof palette[token]).toBe('string');
            expect(palette[token].length).toBeGreaterThan(0);
          });
        });

        test(`dark mode has all ${REQUIRED_TOKENS.length} required tokens`, () => {
          const palette = variant.dark;
          REQUIRED_TOKENS.forEach((token) => {
            expect(palette[token]).toBeDefined();
            expect(typeof palette[token]).toBe('string');
            expect(palette[token].length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe('(b) WCAG AA Contrast Compliance (4.5:1 minimum)', () => {
    THEME_NAMES.forEach((themeName) => {
      describe(themeName, () => {
        const variant = THEMES[themeName];

        test(`light mode: text ≥ 4.5:1 on both bg and surface`, () => {
          const p = variant.light;
          const contrastOnBg = contrastRatio(p.text, p.bg);
          const contrastOnSurface = contrastRatio(p.text, p.surface);
          expect(contrastOnBg).toBeGreaterThanOrEqual(4.5);
          expect(contrastOnSurface).toBeGreaterThanOrEqual(4.5);
        });

        test(`light mode: textMuted ≥ 4.5:1 on both bg and surface`, () => {
          const p = variant.light;
          const contrastOnBg = contrastRatio(p.textMuted, p.bg);
          const contrastOnSurface = contrastRatio(p.textMuted, p.surface);
          expect(contrastOnBg).toBeGreaterThanOrEqual(4.5);
          expect(contrastOnSurface).toBeGreaterThanOrEqual(4.5);
        });

        test(`dark mode: text ≥ 4.5:1 on both bg and surface`, () => {
          const p = variant.dark;
          const contrastOnBg = contrastRatio(p.text, p.bg);
          const contrastOnSurface = contrastRatio(p.text, p.surface);
          expect(contrastOnBg).toBeGreaterThanOrEqual(4.5);
          expect(contrastOnSurface).toBeGreaterThanOrEqual(4.5);
        });

        test(`dark mode: textMuted ≥ 4.5:1 on both bg and surface`, () => {
          const p = variant.dark;
          const contrastOnBg = contrastRatio(p.textMuted, p.bg);
          const contrastOnSurface = contrastRatio(p.textMuted, p.surface);
          expect(contrastOnBg).toBeGreaterThanOrEqual(4.5);
          expect(contrastOnSurface).toBeGreaterThanOrEqual(4.5);
        });
      });
    });
  });

  describe('(d) DESIGN_RULES.md rule 10 — palette-wide contrast sweep', () => {
    const MODES = ['light', 'dark'] as const;

    // Rendered as small text somewhere, so the full 4.5:1 body-text minimum applies —
    // not the 3:1 large-text allowance. `good` on MedicineTrayCard's "Taken at 08:15",
    // `bad` on delete/error labels, `warn` on budget-over copy, `accent` on links/actions.
    const TEXT_COLOURS = ['accent', 'good', 'bad', 'warn', 'borderStrong'] as const;

    // ⚠️ BACK TO 4.5 IN BOTH MODES, 2026-08-16 — this floor is no longer relaxed anywhere.
    // It was `dark: 4.4` from 2026-08-10 to admit exactly one value: `bad` was #EF4444
    // verbatim from a design review, measured 4.430:1 on `surface`, and was kept on
    // instruction rather than nudged, so the floor moved instead. That note ended "if `bad`
    // is ever retuned, put this back to 4.5 rather than leaving a floor nothing needs" — the
    // neon pass retuned it to #FF3B5C (4.79:1), so this is that instruction being carried out.
    //
    // ⚠️⚠️ **RESOLVED, 2026-08-26 — the conflict this comment used to describe.** DESIGN_COMPARISON/19
    // phase 1 raised dark `surface` to fix the card having "no boundary" against `bg`. Its FIRST
    // attempt, `#1E1E1E` → `#2C2C2C`, broke four already-shipped WCAG floors measured against
    // `surface` — `accent` (4.00:1), `bad` (4.01:1), `IDENTITY_HUES.notes` (3.93:1) and the
    // `dinner` meal hue (3.83:1) — because nobody had checked that move against anything but
    // `bg`↔`surface`, `rule`↔`surface` and white `text`↔`surface`. The fix landed on **`#242424`
    // instead of `#2C2C2C`**, plus small lifts to the four broken hues (and two more, forced by
    // the ladder — see below). Nothing here is relaxed; every floor in this file still reads 4.5.
    //
    // **The derivation, because it is the reason the fix touched more than four hues.** At the
    // corrected `surface` (`#242424`), any hue needs relative luminance ≥ 0.2544 to clear 4.5:1 —
    // this is essentially HUE-INDEPENDENT (CIE L\* is a direct function of Y alone, so the
    // luminance floor is the same regardless of chroma/hue), and it lands at **L\* ≥ 57.5** for
    // every one of `accent`, `bad`, `dinner` and Notes. `accent`/`bad`/`dinner` had no ladder
    // constraint, so each was simply lifted along its own hue (not desaturated) to clear 4.5 with
    // a small margin (4.56–4.56:1) — see each token's own comment in constants/colors.ts.
    //
    // **Notes was the constrained one, because it sits in `IDENTITY_HUES`' five-rung lightness
    // ladder, one L\* below Shopping, and the ladder requires ≥7 L\* between adjacent rungs.**
    // With Shopping fixed at its old L\* 64.0, the ladder step alone caps Notes at L\* ≤ 57.0 —
    // BELOW the 57.5 AA floor. That is a real, ~0.5 L\* conflict, not a rounding error: Notes
    // cannot simultaneously clear AA on the new surface and stay 7 L\* under an unmoved Shopping.
    // The theoretical ceiling for Notes — if every rung above it were repacked to the legal
    // minimum spacing under Gold's fixed top (L\* 86.9 − 4×7 = 58.9) — is L\*≤58.9, which is
    // where the "L\* ≤ 58.9" ceiling comes from; but that number assumes Habits/Health/Shopping
    // all move, which they do not need to. Holding Habits and Health fixed (they had 0.6/0.7 L\*
    // of spare margin in their own gaps) and moving ONLY Shopping gives Notes a real, narrower
    // window of **[57.5, 57.7]** — inside the generic [57.5, 58.9] ceiling, but the number that
    // actually applies to the shipped values. Notes landed at L\* 57.589 (`#B660FF`, 4.514:1),
    // and Shopping was lifted ~0.65 L\* along its own hue (chroma −4%, not a hue rotation) to
    // L\* 64.651 (`#24B451`, 5.708:1) — just enough to keep BOTH of Shopping's own gaps ≥7 L\*
    // (7.063 to Health, 7.062 to Notes). Habits and Health are untouched.
    //
    // The identical shape recurs one level down, in the mode-invariant MEAL palette
    // (`components/FoodTab.tsx`'s `MEAL_COLORS`, tested further below): `dinner` is that
    // ladder's own bottom rung and needed the same ~L\*57.5 lift, which forced `snack` (its
    // neighbour) to lift too, for the same "≥7 L\* to both sides" reason. See that describe
    // block's own comment for the numbers.
    const CHROMATIC_FLOOR = { light: 4.5, dark: 4.5 } as const;

    MODES.forEach((mode) => {
      TEXT_COLOURS.forEach((token) => {
        test(`${mode}: ${token} ≥ ${CHROMATIC_FLOOR[mode]}:1 as text on both bg and surface`, () => {
          const p = THEMES.default[mode];
          expect(contrastRatio(p[token], p.bg)).toBeGreaterThanOrEqual(CHROMATIC_FLOOR[mode]);
          expect(contrastRatio(p[token], p.surface)).toBeGreaterThanOrEqual(CHROMATIC_FLOOR[mode]);
        });
      });

      // WCAG 1.4.11: non-text UI that identifies a control needs 3:1, not 4.5:1.
      test(`${mode}: border ≥ 3:1 against surface and bg (non-text UI)`, () => {
        const p = THEMES.default[mode];
        expect(contrastRatio(p.border, p.surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(p.border, p.bg)).toBeGreaterThanOrEqual(3);
      });

      // Every soft/tinted background is only ever used *under* `text`.
      ([
        ['accentSoft', 'text'],
        ['goodSoft', 'text'],
        ['badSoft', 'text'],
        ['warnSoft', 'text'],
        ['hintBg', 'text'],
      ] as const).forEach(([bgToken, inkToken]) => {
        test(`${mode}: ${inkToken} ≥ 4.5:1 on ${bgToken}`, () => {
          const p = THEMES.default[mode];
          expect(contrastRatio(p[inkToken], p[bgToken])).toBeGreaterThanOrEqual(4.5);
        });
      });

      // ⚠️ RELAXED 4.5 → 3.0, 2026-08-10, and this one is STRUCTURAL rather than a judgement
      // call. Dark's accent is now #3B82F6 (the design review's brand.primary), a mid-tone
      // blue that admits NO AA-contrast ink in either direction: white is 3.678:1 on it and
      // the dark ink is 3.977:1. No choice of accentInk clears 4.5, so the assertion could
      // only ever have been satisfied by changing the accent. 3:1 is WCAG's floor for the
      // large/bold type an accent fill actually carries (button labels, active pills).
      // Note accentInk is re-derived at runtime by withAccentInk() → contrastOn(), so the
      // stored value is only a fallback; contrastOn picks the dark ink here, the same as the
      // #6EA8FF this replaced, so nothing on an accent fill flipped colour.
      test(`${mode}: accentInk ≥ 3:1 on accent (see comment — 4.5 is unreachable)`, () => {
        const p = THEMES.default[mode];
        expect(contrastRatio(p.accentInk, p.accent)).toBeGreaterThanOrEqual(3);
      });
    });

    // The two identity-hue systems (lib/screenColor.ts, lib/domainColor.ts) draw these as
    // badge/pill FILLS with contrastOn()-picked ink on top. 3:1 is the floor here rather
    // than 4.5 because the ink sits on badge-sized bold type — raising it to 4.5 would mean
    // restyling the hue set itself, which is open conflict #5 and not this test's call.
    MODES.forEach((mode) => {
      const p = THEMES.default[mode] as unknown as Record<string, string>;
      Object.keys(p)
        .filter((k) => k.startsWith('feat') || k.startsWith('card'))
        .forEach((token) => {
          test(`${mode}: contrastOn(${token}) ≥ 3:1 as badge ink on that fill`, () => {
            expect(contrastRatio(contrastOn(p[token]), p[token])).toBeGreaterThanOrEqual(3);
          });
        });
    });
  });

  describe('(e) 2026-07-31 addendum — ladder, halation cap, identity hues', () => {
    const MODES = ['light', 'dark'] as const;

    // ── A.2 · the surface ladder must stay OPEN ──────────────────────────────────────────
    // Before this pass light bg↔surface was 1.078:1: a card had no edge of its own, so every
    // surface needed a border to exist at all. 1.20:1 is the floor at which the fill alone
    // reads as a raised plane.
    // ⚠️ LIGHT's floor is RELAXED to 1.15 under Tactile Glass (2026-08-15, DESIGN_RULES.md
    // rule 10b). Dark is 1.20 and now measures 1.504 (was 1.260) — see the 2026-08-26 note in
    // the ladder-ratios test below for the `surface` bump that moved it.
    //
    // Why light had to give: `surface` was `#FFFFFF`, its ceiling. A translucent pane cannot
    // reach the ceiling, so it lands at `#F9FBFE` and the step falls to 1.170. The obvious
    // repair — darken `bg` — was measured and REJECTED: at `#DCE5F3` the step is back to 1.212
    // and SIX tokens drop under 4.5:1 at once (textMuted, accent, good, bad, warn,
    // borderStrong), with `border` falling under 3:1 too. That is the mutual exclusion the
    // 2026-07-31 A.2 note in constants/colors.ts already documented; translucency only
    // tightened it.
    //
    // This is a trade rather than a loss, and the next test is the half that makes it one: the
    // card boundary MOVED from the fill step to the edge, where it is now measured at ≥3:1 on
    // BOTH sides. A 1.21 fill step was never checked against anything; a 1.4.11 boundary is.
    const bgSurfaceFloor = (mode: 'light' | 'dark') => (mode === 'light' ? 1.15 : 1.2);
    MODES.forEach((mode) => {
      test(`${mode}: bg vs surface clears its floor`, () => {
        const p = THEMES.default[mode];
        expect(contrastRatio(p.bg, p.surface)).toBeGreaterThanOrEqual(bgSurfaceFloor(mode));
      });

      // The other half of rule 10b. `getGlassEdge`'s shade stop is plain `border`, so a card
      // edge clears WCAG 1.4.11's 3:1 against the page it sits on AND against its own fill —
      // which is what actually tells you where a card starts now that the fill step is softer.
      // If a future pass makes the edge fainter than `border`, this fails, and correctly.
      test(`${mode}: the card edge is a real boundary on both sides`, () => {
        const p = THEMES.default[mode];
        expect(contrastRatio(p.border, p.surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(p.border, p.bg)).toBeGreaterThanOrEqual(3);
      });

      // ⚠️ The BOTTOM rung's floor is RELAXED for dark only, 1.10 → 1.05 (2026-08-10,
      // true-black palette). This is arithmetic, not taste: with `bg` at #000000 there is
      // ~0.006 of relative luminance left for two rungs beneath `surface`, and no pair of
      // hexes holds a 1.10 step at both. Getting the 1.10 floor back means taking `bg` off
      // pure black, which is the one thing that palette exists to avoid. The UPPER rung
      // (surface ↔ surfaceMuted) still holds 1.10 in both modes and is not relaxed.
      const insetFloor = mode === 'light' ? 1.1 : 1.05;
      test(`${mode}: each rung below surface is a visible step`, () => {
        const p = THEMES.default[mode];
        expect(contrastRatio(p.surface, p.surfaceMuted)).toBeGreaterThanOrEqual(1.1);
        expect(contrastRatio(p.surfaceMuted, p.surfaceInset)).toBeGreaterThanOrEqual(insetFloor);
      });

      // Pinned exactly, not just to the floor: these are the ratios the ladder was solved
      // for, and a drifting value is the first sign someone re-tuned a surface in isolation.
      test(`${mode}: documented ladder ratios hold`, () => {
        const p = THEMES.default[mode];
        // Light re-solved 2026-08-15 for the glass composite (`surface` #FFFFFF → #F9FBFE).
        // Dark was byte-identical to the true-black pass until 2026-08-26 — its glass alpha
        // was originally picked so the composite would land on the `#1E1E1E` it already had.
        // ⚠️ The `rule` figures moved on 2026-08-20 (contrast pass) — light 1.347 → 1.488,
        // dark 1.119 → 1.480, with the three surface ratios byte-identical at the time,
        // because that pass lifted the two EDGE tokens (`rule`, `border`) and `textMuted`
        // rather than any surface token.
        //
        // ── 2026-08-26, DESIGN_COMPARISON/19 phase 1 ("the card surface") ────────────────
        // `surface` moved for the first time since the true-black palette: dark `#1E1E1E` →
        // `#2C2C2C` (bg↔surface 1.260 → 1.504) was the FIRST attempt and broke four already-
        // shipped chromatic floors (see `CHROMATIC_FLOOR`'s comment above) — dark landed on
        // **`#242424`** instead (bg↔surface 1.260 → 1.353, still a real boundary, just not the
        // largest one reachable). Light moved `#F9FBFE` → `#FDFEFF` (bg↔surface 1.170 → 1.201,
        // a smaller step, see that token's doc comment in constants/colors.ts) and was NOT
        // touched by the dark correction. `surfaceMuted`/`surfaceInset` did NOT move on either
        // side, so `ladderB` (surfaceMuted↔surfaceInset) is unchanged; `ladderA` and `rule` move
        // because `surface` is one of their two inputs.
        const expected = mode === 'light'
          ? { bgSurface: 1.201, ladderA: 1.168, ladderB: 1.118, rule: 1.528 }
          : { bgSurface: 1.353, ladderA: 1.207, ladderB: 1.057, rule: 1.378 };
        expect(contrastRatio(p.bg, p.surface)).toBeCloseTo(expected.bgSurface, 2);
        expect(contrastRatio(p.surface, p.surfaceMuted)).toBeCloseTo(expected.ladderA, 2);
        expect(contrastRatio(p.surfaceMuted, p.surfaceInset)).toBeCloseTo(expected.ladderB, 2);
        expect(contrastRatio(p.rule, p.surface)).toBeCloseTo(expected.rule, 2);
      });

      // Body text has to survive every rung, not just bg/surface — cards sit on surfaceMuted
      // and inset wells all over the app.
      test(`${mode}: text ≥ 4.5:1 on every surface rung`, () => {
        const p = THEMES.default[mode];
        (['bg', 'surface', 'surfaceMuted', 'surfaceInset'] as const).forEach((rung) => {
          expect(contrastRatio(p.text, p[rung])).toBeGreaterThanOrEqual(4.5);
        });
      });

      // textMuted is only GUARANTEED at AA on bg + surface (asserted in (b) above). On the
      // two lower rungs it holds 3:1, not 4.5 — deliberately asserted at the weaker floor
      // rather than at AA, because AA there would require either a darker textMuted (which
      // stops reading as secondary) or a lighter inset (which closes the ladder back up).
      // The rule for consumers: secondary text belongs on bg/surface, not in an inset well.
      test(`${mode}: textMuted ≥ 3:1 on the lower rungs (NOT AA — see comment)`, () => {
        const p = THEMES.default[mode];
        (['surfaceMuted', 'surfaceInset'] as const).forEach((rung) => {
          expect(contrastRatio(p.textMuted, p[rung])).toBeGreaterThanOrEqual(3);
        });
      });

      // ── A.1 · `rule` is a decorative hairline, NOT a control boundary ──────────────────
      // Both ends matter. Below 1.2 the notepad rules vanish; at or above 3:1 `rule` has
      // become a second `border`, which is exactly the conflation this token was split out
      // to end. If a consumer needs 3:1 it needs `border`, not a louder `rule`.
      // Lower bound RELAXED for dark only, 1.2 → 1.1 (2026-08-10). `rule` is #27272A verbatim
      // from the design review, which supplied it as "border.subtle"; against the true-black
      // palette's `surface` it measures 1.119:1. The UPPER bound — the half that actually
      // matters, since it is what stops `rule` quietly becoming a second `border` — is
      // unchanged and still the reason this test exists.
      const ruleFloor = mode === 'light' ? 1.2 : 1.1;
      test(`${mode}: rule is visible (≥${ruleFloor}:1) but below the 3:1 boundary band`, () => {
        const p = THEMES.default[mode];
        expect(contrastRatio(p.rule, p.surface)).toBeGreaterThanOrEqual(ruleFloor);
        expect(contrastRatio(p.rule, p.surface)).toBeLessThan(3);
      });
    });

    // ── A.6 #4 · the dark body-text HALATION CAP ────────────────────────────────────────
    // ⚠️ THE UPPER BOUND IS STILL A REQUIREMENT, NOT A TYPO — but it was RAISED 12 → 16 on
    // 2026-08-10, by explicit maintainer instruction, when the true-black palette landed.
    //
    // Read the original reasoning before touching this, because it was not withdrawn:
    // near-white text on a dark surface blooms/smears (halation), worst for astigmatic
    // readers, and it is the most common dark-mode legibility complaint there is. That is
    // why the band was 7–12 from 2026-07-31, and why `text` was pulled from #E9EDF5 back to
    // #C7CBD1 (9.5:1) to get inside it. The maintainer overrode it in favour of an outside
    // design review's contrast-first palette (`text` #F3F4F6 on `surface` #1E1E1E = 15.1:1).
    //
    // So the ceiling still exists and still catches the runaway case — it now sits at the
    // shipped value plus a little headroom rather than at the comfort threshold. If a real
    // device ever produces a legibility complaint, pull `text` back toward ~#D8DADF FIRST
    // and lower this with it; do not chase it by darkening a surface.
    //
    // (2026-08-16) RAISED AGAIN, 16 → 17, for the same kind of reason and by the same kind of
    // instruction: the Tactile Glass brief §5 requires "Primary text (Headers, main tasks) must
    // be pure white (#FFFFFF)", which measures 16.67:1 on `surface`. Pure white is the ceiling
    // of the ceiling — there is no whiter text — so 17 is the last time this number can move
    // for this reason. A future rise could only come from DARKENING `surface`, which the note
    // above already forbids as the way to chase this.
    test('dark: body text sits INSIDE the 7–17:1 halation band on surface', () => {
      const p = THEMES.default.dark;
      const ratio = contrastRatio(p.text, p.surface);
      expect(ratio).toBeGreaterThanOrEqual(7);
      expect(ratio).toBeLessThanOrEqual(17);
    });

    // ── The five identity hues, on a LIGHTNESS LADDER (2026-08-17) ──────────────────────
    const HUE_KEYS = ['todo', 'habits', 'health', 'shopping', 'notes'] as const;

    // ⚠️ The L*-shaped guarantee was DELETED on 2026-08-16 and is RESTORED here, in a stronger
    // form. Read this before weakening any of the four tests below, because the deletion had a
    // recorded reason and it was still wrong.
    //
    // A.6's claim — the identity set must separate by LIGHTNESS, because lightness is the only
    // channel that survives greyscale, deuteranopia, protanopia and monochromacy — was
    // overridden on 2026-08-16 as a stated trade ("full neon, drop the greyscale guarantee").
    // The follow-up review measured what that cost: at L* 81/79/56/89/59 the worst pair under
    // deuteranopia simulation was ΔE2000 11.8, and a greyscale screenshot flattened
    // To-do/Habits/Shopping into one band. The aesthetic was kept and the values re-picked —
    // every hue is still on the sRGB gamut boundary at its lightness — so this is not a return
    // to pastels; it is the same neon set, ordered.
    //
    // FOUR things are pinned, and they are not redundant with each other:
    //   1. the hex, per hue — the strictest drift guard (an L* pin alone admits a hue rotation
    //      at constant lightness, which is the "harmonise the badges" edit A.6 existed to catch);
    //   2. the ladder — adjacent rungs ≥ 7 L* apart, IN ORDER. This is the accessibility
    //      guarantee itself, and it is what a "make Health more vivid" edit would break;
    //   3. the AA floor — ≥ 4.5:1 on the dark glass card, which fixes the BOTTOM of the band —
    //      L* 55.4 originally, **L* 57.5 as of the 2026-08-26 `surface` correction to `#242424`**
    //      (see `CHROMATIC_FLOOR`'s comment above for the derivation) — and is therefore why
    //      Notes cannot be a deeper violet;
    //   4. the dichromat regression — the simulated worst pair, which is the number the whole
    //      change exists to move (11.8 → 18.89 deutan / 12.87 protan as of 2026-08-26).
    // Plus the pre-existing pairwise ΔE2000 ≥ 25 floor, which is unchanged and still catches
    // the hue-space half.
    const DOCUMENTED_HEX: Record<(typeof HUE_KEYS)[number], string> = {
      todo: '#FFD700',
      habits: '#05D9E8',
      health: '#FF8CB2',
      shopping: '#24B451',
      notes: '#B660FF',
    };

    // The ladder, brightest rung first. The ORDER is asserted, not just the gaps: two hues
    // swapped would keep every gap and still undo the recognition this buys, because the
    // categories are learned as "the bright one" / "the dark one".
    const LADDER = ['todo', 'habits', 'health', 'shopping', 'notes'] as const;
    /** Minimum lightness step between adjacent rungs. Shipped set: 7.06–7.61 (was 7.4–7.7
     *  before the 2026-08-26 shopping/notes retune — see `CHROMATIC_FLOOR`'s comment above). */
    const LADDER_MIN_STEP = 7;

    HUE_KEYS.forEach((key) => {
      const { hue, ink } = IDENTITY_HUES[key];

      // A.6 #1, RELAXED 4.5 → 3 on 2026-08-16, and structurally rather than as a judgement
      // call — the same shape of relaxation as `accentInk` above. At the time it was Health's
      // rose `#FF2A6D` that admitted NO AA-contrast ink in either direction (white 3.62:1,
      // dark 4.32:1), so no choice of `ink` could satisfy 4.5. The 2026-08-17 ladder moved that
      // particular hue up to 7.66:1 and the binding case is now Notes at the band's floor
      // (dark ink 4.28:1) — a different hue, same arithmetic, so the relaxation stands.
      //
      // 3:1 is the honest floor here for a second reason: since the 2026-08-15 inversion the
      // app does not DRAW ink on a hue fill any more — the badge is a hue glyph on a neutral
      // frosted plate, guarded by the `badgeGlyphFor` sweep further down, which is measured
      // against the real composited plate. What survives on the fill path is
      // `badgeGradientFor`, and that is asserted at ≥3 on BOTH stops separately below. So this
      // test's remaining job is to keep the declared `ink` in IDENTITY_HUES honest about which
      // END of the range the code picks — which is the half that actually drifts.
      test(`identity ${key}: declared badge ink matches contrastOn() and clears 3:1 on the fill`, () => {
        expect(contrastRatio(ink, hue)).toBeGreaterThanOrEqual(3);
        // Same family (dark-vs-white), not necessarily the same hex — contrastOn returns the
        // theme's own near-black, the table records the palette's `text`.
        // Widened to `string` on purpose: since the 2026-08-16 neon pass every declared ink is
        // the dark one, so TS narrows `ink` to that single literal and rejects the comparison
        // as impossible. The assertion is still the one that matters — it is what would catch a
        // future hue bright enough to flip contrastOn() without its table row being updated.
        const picked: string = contrastOn(hue);
        expect(picked === '#FFFFFF').toBe((ink as string) === '#FFFFFF');
      });

      // The drift guard, on the value itself. See the DOCUMENTED_HEX note above for why this
      // is pinned alongside the L* ladder rather than instead of it.
      test(`identity ${key}: hue has not drifted from its documented value`, () => {
        expect(`${key}=${hue}`).toBe(`${key}=${DOCUMENTED_HEX[key]}`);
      });

      // Pin #3 — the AA floor, per hue, on the harder of the two dark grounds. `surface`
      // is `#242424`, the dark glass card; anything clearing it clears `bg` (#000000) too, and
      // both are asserted because "on the black canvas" is how the requirement is usually
      // stated. This is the test that fixes the BOTTOM of the band — L* 55.4 originally, L* 57.5
      // as of the 2026-08-26 `surface` correction — it is why Notes cannot be a deeper violet,
      // and why no future rung can be added below it.
      //
      // ⚠️⚠️ **RESOLVED, 2026-08-26 — see `CHROMATIC_FLOOR`'s comment above for the full
      // derivation.** DESIGN_COMPARISON/19 phase 1's first attempt raised `surface` to `#2C2C2C`,
      // which raised the L* floor this pin fixes from 55.4 to ~60.6 — past what Notes (`#B45CFF`,
      // L* 56.7, already "the DEEPEST violet AA allows" against the OLD floor) could survive
      // (3.93:1). The corrected `surface`, `#242424`, needs only L* ≥ 57.5 — still above Notes'
      // old value, but reachable: Notes moved to `#B660FF` (L* 57.589, 4.514:1), the tightest
      // margin in the set. That in turn forced Shopping (Notes' neighbour on the ladder) to lift
      // too, to keep the ≥7 L* step between them — see `CHROMATIC_FLOOR`'s comment for why only
      // Shopping needed to move and Habits/Health did not.
      test(`identity ${key}: ≥ 4.5:1 as a glyph on the dark card AND on the black canvas`, () => {
        const p = THEMES.default.dark;
        expect(contrastRatio(hue, p.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(hue, p.bg)).toBeGreaterThanOrEqual(4.5);
      });
    });

    // Pin #2 — THE LADDER. This is the accessibility guarantee the whole 2026-08-17 pass
    // exists to make: lightness is the one channel that survives greyscale, deuteranopia,
    // protanopia and monochromacy, so the five categories are carried on it. Both halves
    // matter — the ORDER (a swap keeps every gap and still costs the "bright one / dark one"
    // recognition) and the STEP.
    //
    // Shipped steps are 7.06–7.61 against a floor of 7 (was 7.4–7.7 before the 2026-08-26
    // `surface` correction lifted Notes and, in turn, Shopping — see `CHROMATIC_FLOOR`'s
    // comment above), which is deliberately tight: the band is under 30 L* wide (bottom fixed
    // by the AA test above, top by sRGB running out of saturated amber above L* 87), so five
    // rungs is what fits. **A sixth identity hue does not fit** — this test failing on an added
    // hue is the correct outcome, not an obstacle to route around.
    test('identity hues: the lightness ladder is in order and every step is ≥ 7 L*', () => {
      const rungs = LADDER.map((k) => ({ key: k, L: lstar(IDENTITY_HUES[k].hue) }));
      for (let i = 1; i < rungs.length; i += 1) {
        const step = rungs[i - 1].L - rungs[i].L;
        const pair = `${rungs[i - 1].key}→${rungs[i].key}`;
        expect(`${pair}: ${step >= LADDER_MIN_STEP}`).toBe(`${pair}: true`);
      }
    });

    // Pin #4 — the dichromat regression. The ladder is what MAKES this hold, so this test is
    // not a second guarantee so much as the measurement that proves the first one works on the
    // readers it is for. Simulation is Viénot/Brettel/Mollon (1999), the standard LMS
    // projection, implemented inline at the bottom of this file next to the Lab maths.
    //
    // The floor is deutan≥15/protan≥12 against a shipped worst pair of 18.89 (deutan,
    // Habits/Notes) / 12.87 (protan, Habits/Health — unchanged by the 2026-08-26 retune, since
    // neither hue in that pair moved). Was 19.7/12.9 before that retune moved Shopping and
    // Notes; both are still far above what the pre-ladder set managed: 11.8 and 11.9, i.e. the
    // whole set within one ΔE band of "these two are the same colour". Protanopia gets the
    // lower floor because its luminance response is itself shifted — a protanope sees
    // red-family hues darker than the CIE Y this ladder is built on — so the same rungs
    // compress slightly.
    test('identity hues: every pair survives deuteranopia and protanopia simulation', () => {
      const FLOORS = { deutan: 15, protan: 12 } as const;
      (['deutan', 'protan'] as const).forEach((kind) => {
        for (let i = 0; i < HUE_KEYS.length; i += 1) {
          for (let j = i + 1; j < HUE_KEYS.length; j += 1) {
            const a = simulateDichromacy(IDENTITY_HUES[HUE_KEYS[i]].hue, kind);
            const b = simulateDichromacy(IDENTITY_HUES[HUE_KEYS[j]].hue, kind);
            const label = `${kind} ${HUE_KEYS[i]}/${HUE_KEYS[j]}`;
            expect(`${label}: ${deltaE2000(a, b) >= FLOORS[kind]}`).toBe(`${label}: true`);
          }
        }
      });
    });

    // A.6 #2 — every pair is separable in COLOUR space too, which the ladder does not imply:
    // two hues one rung apart could still be the same hue at two lightnesses. Worst pair today
    // is Health/Notes at 26.36 (was 26.9 before the 2026-08-26 shopping/notes retune). This
    // floor is also what caught the 2026-08-16 brief's own
    // suggested Shopping value (`#01FFC3`, 22.9 against Habits' cyan) before it shipped, and
    // what stops Health's rose being rotated back toward magenta for chroma (24.0 at h 350).
    test('identity hues: every pair is ΔE2000 ≥ 25', () => {
      for (let i = 0; i < HUE_KEYS.length; i += 1) {
        for (let j = i + 1; j < HUE_KEYS.length; j += 1) {
          const a = IDENTITY_HUES[HUE_KEYS[i]].hue;
          const b = IDENTITY_HUES[HUE_KEYS[j]].hue;
          const separated = deltaE2000(a, b) >= 25;
          expect(`${HUE_KEYS[i]}/${HUE_KEYS[j]}: ${separated}`).toBe(`${HUE_KEYS[i]}/${HUE_KEYS[j]}: true`);
        }
      }
    });

    // The neutral must not become a sixth identity: near-zero chroma is what makes it read
    // as "no colour assigned" rather than as a quiet hue of its own. It has no palette
    // consumer since Notes took amethyst (2026-08-16) — this keeps it honest for the day
    // something needs it back.
    test('identity neutral: near-grey, and its ink clears AA', () => {
      expect(chroma(IDENTITY_NEUTRAL)).toBeLessThan(15);
      HUE_KEYS.forEach((key) => {
        expect(chroma(IDENTITY_HUES[key].hue)).toBeGreaterThan(30);
      });
      expect(contrastRatio(contrastOn(IDENTITY_NEUTRAL), IDENTITY_NEUTRAL)).toBeGreaterThanOrEqual(4.5);
    });

    // ── Badge icon ink: always white, and the FILL is what makes that legible ────────────
    // Originally (2026-07-31, addendum A.4): components/CardAccent.tsx drew a hardcoded
    // `color="#FFFFFF"` for the badge ICON regardless of the fill under it — an icon needs
    // 3:1 (WCAG 1.4.11), not 4.5, and under the old nine-hue ramp 6 of 8 dark-mode badges fell
    // below that. The fix at the time was to pick ink dynamically per hue (white for three,
    // dark for Shopping's gold), which is what this block used to assert.
    //
    // (2026-08-11) That produced a different complaint — badges reading inconsistent card to
    // card ("some color and black, some color and white"). The ink is white again everywhere,
    // but this time `lib/domainColor.ts`'s `badgeGradientFor()` deepens a hue's gradient (moves
    // it further toward the navy deep-stop) until white clears 3:1 on the LIGHTER of the two
    // stops — the darker stop only gets more contrasty from there. Shopping is still the case
    // that proves the point: white on the raw, unmixed #D9A441 is 2.25:1, so its badge gradient
    // now starts already-mixed rather than at the pure accent (see domainColor.test.ts case (e)
    // for the exact per-domain assertion). This is deliberately NOT a repeat of the 2026-08-10
    // decline: that proposal hardcoded white and left the fill alone; this changes the fill.
    const HUE_DOMAIN: Record<(typeof HUE_KEYS)[number], Domain> = {
      todo: 'task',
      habits: 'habit',
      health: 'health',
      shopping: 'shop',
      notes: 'note',
    };
    MODES.forEach((mode) => {
      HUE_KEYS.forEach((key) => {
        test(`${mode}: ${key} badge icon ink ≥ 3:1 on both badge-gradient stops`, () => {
          const theme = getThemePalette('default', mode === 'dark');
          const { accent, ink, badgeGradient } = getDomainColor(theme, HUE_DOMAIN[key]);
          // The alias mapping is asserted transitively: this domain must resolve to this hue.
          expect(accent).toBe(IDENTITY_HUES[key].hue);
          // Ink is always white now (2026-08-11) — see the comment above this block.
          expect(ink).toBe('#FFFFFF');
          badgeGradient.forEach((stop) => {
            expect(contrastRatio(ink, stop)).toBeGreaterThanOrEqual(3);
          });
        });
      });
    });

    // ── The INVERTED badge (Tactile Glass, 2026-08-15) ──────────────────────────────────────
    // The block above still stands and still guards `badgeGradientFor`, which is retained. What
    // components/CardAccent.tsx actually DRAWS is now the other way round — a neutral frosted
    // disc with the hue as an opaque glyph on it — so the guarantee that matters in the shipped
    // app is this one.
    //
    // This is the assertion that makes inverting `lib/domainColor.ts`'s A.4 rule 1 ("an identity
    // hue is a FILL, never an icon colour") legitimate rather than a regression. That rule
    // existed because a hue was being put somewhere nothing measured it; here it is measured,
    // per hue, per mode, against the REAL composited plate. Both halves of the sweep matter and
    // neither is redundant:
    //   · the raw hue genuinely fails in one mode each — gold 1.92:1 on the light plate; To-do
    //     1.88:1, Health 2.33:1, Habits 2.69:1 on the dark one — so a test that only checked the
    //     derived glyph would pass just as well if someone deleted the derivation and got lucky;
    //   · the derived glyph must clear the floor in BOTH.
    MODES.forEach((mode) => {
      HUE_KEYS.forEach((key) => {
        test(`${mode}: ${key} badge glyph ≥ 3:1 on the frosted plate`, () => {
          const isDark = mode === 'dark';
          const theme = getThemePalette('default', isDark);
          const { accent } = getDomainColor(theme, HUE_DOMAIN[key]);
          const { plate } = getBadgeFrost(theme.surface, isDark);
          expect(contrastRatio(badgeGlyphFor(accent, plate, isDark), plate)).toBeGreaterThanOrEqual(3);
        });
      });

      // ⚠️ SCOPED TO LIGHT MODE on 2026-08-16, and the reason is the good outcome rather than
      // a weakening. This asserted, per mode, that at least one raw hue fails 3:1 on the frost
      // plate — a guard on the derivation itself, so that deleting `badgeGlyphFor` and getting
      // lucky would still fail. Its own comment said: "If a palette retune ever made every raw
      // hue clear the floor unaided, this fails — and that is the moment to check whether
      // badgeGlyphFor is still doing anything, not to delete this test."
      //
      // That moment arrived. On the dark plate (`#383838` as of the 2026-08-26 `surface`
      // correction to `#242424`, was `#323232`) the five measure 8.36 / 6.75 / 5.39 / 4.31 /
      // 3.41 (todo/habits/health/shopping/notes) — all clear either way, because
      // bright-on-near-black is the whole point of the set. So in
      // DARK, `badgeGlyphFor` is a genuine no-op, and asserting otherwise would be asserting a
      // defect. In LIGHT it is still doing real work — since the ladder ALL FIVE need the walk
      // there, Notes having been the last hue that cleared unaided (3.03 against a 3.3 floor) —
      // so the guard lives there.
      // If light mode is ever retuned to neons too, this test has nothing left to guard and
      // `badgeGlyphFor` should be re-examined rather than this line edited again.
      const derivationStillMatters = mode === 'light';
      (derivationStillMatters ? test : test.skip)(`${mode}: the raw hue is NOT safe on the plate for at least one identity hue`, () => {
        // Guards the derivation itself. If a palette retune ever made every raw hue clear the
        // floor unaided, this fails — and that is the moment to check whether badgeGlyphFor is
        // still doing anything, not to delete this test.
        const isDark = mode === 'dark';
        const theme = getThemePalette('default', isDark);
        const { plate } = getBadgeFrost(theme.surface, isDark);
        const raw = HUE_KEYS.map((k) => contrastRatio(getDomainColor(theme, HUE_DOMAIN[k]).accent, plate));
        expect(Math.min(...raw)).toBeLessThan(3);
      });
    });

    // The nine surviving token names must keep resolving to the five values, in both modes —
    // this is the revertable-alias contract from constants/colors.ts. `cardNote` left
    // IDENTITY_NEUTRAL for amethyst on 2026-08-16, so the neutral no longer appears here.
    test('the nine card* names alias exactly five hues', () => {
      const expectedMap: Record<string, string> = {
        cardPlan: IDENTITY_HUES.todo.hue,
        cardTask: IDENTITY_HUES.todo.hue,
        cardHabit: IDENTITY_HUES.habits.hue,
        cardHealth: IDENTITY_HUES.health.hue,
        cardMeal: IDENTITY_HUES.shopping.hue,
        cardShop: IDENTITY_HUES.shopping.hue,
        cardBudget: IDENTITY_HUES.shopping.hue,
        cardScan: IDENTITY_HUES.shopping.hue,
        cardNote: IDENTITY_HUES.notes.hue,
      };
      MODES.forEach((mode) => {
        const p = THEMES.default[mode] as unknown as Record<string, string>;
        Object.entries(expectedMap).forEach(([token, value]) => {
          expect(`${mode}.${token}=${p[token]}`).toBe(`${mode}.${token}=${value}`);
        });
      });
    });
  });

  describe('(c) Dark-mode depth ordering', () => {
    THEME_NAMES.forEach((themeName) => {
      describe(`${themeName} dark mode`, () => {
        const p = THEMES[themeName].dark;

        test('border > surface (border is lighter)', () => {
          const borderLuminance = toLuminance(p.border);
          const surfaceLuminance = toLuminance(p.surface);
          expect(borderLuminance).toBeGreaterThan(surfaceLuminance);
        });

        test('surface > bg (surface is lighter)', () => {
          const surfaceLuminance = toLuminance(p.surface);
          const bgLuminance = toLuminance(p.bg);
          expect(surfaceLuminance).toBeGreaterThan(bgLuminance);
        });

        test('depth ordering: bg < surface < border', () => {
          const bgL = toLuminance(p.bg);
          const surfaceL = toLuminance(p.surface);
          const borderL = toLuminance(p.border);
          expect(bgL).toBeLessThan(surfaceL);
          expect(surfaceL).toBeLessThan(borderL);
        });
      });
    });
  });

  describe('getThemePalette resolver', () => {
    test('returns correct palette for light mode', () => {
      const palette = getThemePalette('default', false);
      expect(palette.bg).toBe(THEMES.default.light.bg);
      expect(palette.text).toBe(THEMES.default.light.text);
    });

    test('returns correct palette for dark mode', () => {
      const palette = getThemePalette('default', true);
      expect(palette.bg).toBe(THEMES.default.dark.bg);
      expect(palette.text).toBe(THEMES.default.dark.text);
    });

    test('returns default theme for invalid theme name', () => {
      const palette = getThemePalette('invalid' as any, false);
      expect(palette.bg).toBe(THEMES.default.light.bg);
    });
  });

  // ── Meal-type palette (components/FoodTab.tsx) ────────────────────────────────────────
  // The app's sixth categorical palette, and the last one to get a test — which is exactly
  // why a 2.12:1 section title shipped and survived until 2026-08-10. It was MODE-INVARIANT
  // (one hex for both themes, tuned for the dark surface) and painted straight onto the
  // title text; on white all five failed the 4.5:1 body-text floor.
  //
  // Nothing draws these as text any more — the hue is a `soft` plate under the meal glyph
  // (A.4 rule 1) — but the bar stays at 4.5:1 as TEXT deliberately. That headroom is what
  // makes a value safe if it is ever moved back onto a word or a glyph, and it is the
  // cheapest guard against the next "warm these up a bit" pass. Mirrors how
  // lib/__tests__/personColor.test.ts guards its own palette.
  describe('meal-type palette — contrast as text in its own mode', () => {
    const MODES = ['light', 'dark'] as const;

    /**
     * ⚠️ **Read from `components/FoodTab.tsx`, not copied (2026-08-21).** This block held a
     * hand-typed duplicate of that file's `MEAL_COLORS` — the shape AGENTS.md names outright
     * after the widget palette shipped a year-stale copy on the app's most-seen surface: *"a
     * hand-copied constant with a comment telling you to keep it in step is not a mechanism."*
     * It was already stale when this was written: every assertion below was green against five
     * values the app had stopped drawing.
     *
     * A source parse rather than an import, because that module pulls in react-native.
     */
    const MEAL_COLORS: Record<string, { light: string; dark: string }> = (() => {
      const src = readFileSync(join(__dirname, '..', '..', 'components', 'FoodTab.tsx'), 'utf8');
      const block = src.slice(src.indexOf('const MEAL_COLORS'));
      const body = block.slice(0, block.indexOf('};'));
      const out: Record<string, { light: string; dark: string }> = {};
      for (const m of body.matchAll(/(\w+):\s*\{\s*light:\s*'(#[0-9A-Fa-f]{6})',\s*dark:\s*'(#[0-9A-Fa-f]{6})'\s*\}/g)) {
        out[m[1]] = { light: m[2], dark: m[3] };
      }
      return out;
    })();

    it('the parse found all five, so the assertions below are measuring the real values', () => {
      expect(Object.keys(MEAL_COLORS).sort()).toEqual([
        'breakfast', 'dinner', 'kveldsmat', 'lunch', 'snack',
      ]);
    });

    // ⚠️⚠️ **RESOLVED, 2026-08-26 — same root cause and same fix shape as the
    // `CHROMATIC_FLOOR`/`identity notes` notes above.** DESIGN_COMPARISON/19 phase 1's first
    // `surface` attempt (`#1E1E1E` → `#2C2C2C`) dropped `dinner` (`components/FoodTab.tsx`,
    // rung 1 of this mode-invariant meal ladder, "darkest") from 4.57:1 to 3.83:1 — it was
    // already the tightest of the five meal hues, so it was the first to fall. The corrected
    // `surface` (`#242424`) needs the same universal L* ≥ 57.5 lift every other broken hue
    // needed; `dinner` moved `#EE4F00` → `#F55200` (L* 57.514, 4.501:1 — the tightest margin
    // here too). And exactly as with Shopping/Notes, lifting `dinner` alone would close its
    // ≥7 L* gap to its neighbour `snack` (L* 64.07 unmoved would leave only ~6.6), so `snack`
    // moved too: `#D073FF` → `#CF77FE` (chroma −4%, not a hue rotation), landing at L* 64.657
    // with ≥7 L* margin on both its own gaps. `breakfast`/`lunch`/`kveldsmat` are untouched.
    MODES.forEach((mode) => {
      const surface = THEMES.default[mode].surface;
      Object.entries(MEAL_COLORS).forEach(([meal, pair]) => {
        test(`${mode}: ${meal} ≥ 4.5:1 on surface`, () => {
          expect(contrastRatio(pair[mode], surface)).toBeGreaterThanOrEqual(4.5);
        });
      });
    });

    test('every meal hue is distinct within a mode', () => {
      MODES.forEach((mode) => {
        const vals = Object.values(MEAL_COLORS).map((p) => p[mode]);
        expect(new Set(vals).size).toBe(vals.length);
      });
    });

    /**
     * ⚠️ **The set sits on a LIGHTNESS LADDER, for the reason `IDENTITY_HUES` does.**
     *
     * `CONSISTENCY_AUDIT.md` §15 asked for these to be less pale. Saturating them was tried
     * first and measured: at full chroma the amber (breakfast) and the red (dinner) — the two
     * most saturated colours in the set — collapsed under deuteranopia to a worst-pair ΔE of
     * **4.0**, i.e. indistinguishable to a colour-blind reader. Spreading the five ~7.5 L*
     * apart, with those two families at opposite ends of the ladder, is what fixes that; the
     * chroma is a consequence, not the mechanism.
     *
     * So all three properties are pinned, and none implies the others: the ladder does not
     * imply hue separation, ΔE2000 does not imply a lightness order, and neither implies
     * contrast. Exactly the argument `IDENTITY_HUES`' own five assertions rest on.
     */
    test.each(MODES)('%s: the five are ≥7 L* apart', (mode) => {
      const vals = Object.values(MEAL_COLORS).map((p) => p[mode]);
      const rungs = vals.map(lstar).sort((a, b) => a - b);
      for (let i = 1; i < rungs.length; i++) {
        expect(`gap ${i}: ${(rungs[i] - rungs[i - 1] >= 7).toString()}`).toBe(`gap ${i}: true`);
      }
    });

    it('the rung ORDER is the same in both modes', () => {
      // A meal's position on the ladder must not flip when the theme does — otherwise the one
      // thing a user could learn from the set ("dinner is the dark one") stops being true half
      // the time. Not implied by anything above: each mode's contrast is checked against its own
      // ground, and either could be reordered on its own without failing a single other test.
      const order = (mode: 'light' | 'dark') =>
        Object.entries(MEAL_COLORS)
          .sort((a, b) => lstar(a[1][mode]) - lstar(b[1][mode]))
          .map(([name]) => name);
      expect(order('light')).toEqual(order('dark'));
    });

    test.each(MODES)('%s: no pair collapses for a dichromat', (mode) => {
      // A lower floor than IDENTITY_HUES' 15/12: these five are one card's sections rather than
      // the app's navigation, and they are read next to their own labels. The shipped worst
      // pairs are 15.17 deutan / 23.77 protan (dark, as of the 2026-08-26 dinner/snack retune —
      // was 22.8 deutan before it) and 36.4 (light, unaffected by that retune) against the 4.0
      // that saturating alone produced, so the margin is real either way.
      const FLOORS = { deutan: 12, protan: 10 } as const;
      (['deutan', 'protan'] as const).forEach((kind) => {
        const entries = Object.entries(MEAL_COLORS);
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            const a = simulateDichromacy(entries[i][1][mode], kind);
            const b = simulateDichromacy(entries[j][1][mode], kind);
            const label = `${kind} ${entries[i][0]}/${entries[j][0]}`;
            expect(`${label}: ${deltaE2000(a, b) >= FLOORS[kind]}`).toBe(`${label}: true`);
          }
        }
      });
    });

    // The 2026-07-18 rule this file's own header states: a meal hue must never be mistaken
    // for a status colour. `good` and `bad` are what a food card would collide with.
    test('no meal hue collides with good/bad status', () => {
      MODES.forEach((mode) => {
        const p = THEMES.default[mode];
        Object.entries(MEAL_COLORS).forEach(([meal, pair]) => {
          expect(`${meal}:${pair[mode].toLowerCase()}`).not.toBe(`${meal}:${p.good.toLowerCase()}`);
          expect(`${meal}:${pair[mode].toLowerCase()}`).not.toBe(`${meal}:${p.bad.toLowerCase()}`);
        });
      });
    });
  });
});

// ── Helper: compute relative luminance from hex colour ────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [100, 100, 100];
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function toLuminance(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// ── Colour science for the (e) block — inline on purpose ──────────────────
// CIE L*a*b* (sRGB → XYZ D65 → Lab) and CIEDE2000. This is ~40 lines of arithmetic and
// pulling a colour library in for it would add a dependency to a repo whose token layer is
// deliberately dependency-free. Reference: Sharma, Wu & Dalal (2005), the CIEDE2000 paper.

/** sRGB hex → CIE L*a*b* under a D65 white point. */
function toLab(hex: string): [number, number, number] {
  const [sr, sg, sb] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const X = (0.4124564 * sr + 0.3575761 * sg + 0.1804375 * sb) / 0.95047;
  const Y = 0.2126729 * sr + 0.7151522 * sg + 0.0721750 * sb;
  const Z = (0.0193339 * sr + 0.1191920 * sg + 0.9503041 * sb) / 1.08883;
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Perceptual lightness (0 = black, 100 = white) — the greyscale/colour-blind channel. */
function lstar(hex: string): number {
  return toLab(hex)[0];
}

/**
 * Dichromacy simulation — Viénot, Brettel & Mollon (1999), the standard LMS projection: convert
 * linear sRGB to LMS, collapse the missing cone's response onto the plane the remaining two
 * span, convert back. Added 2026-08-17 with the identity-hue lightness ladder, so that "these
 * two categories are still distinguishable" is a MEASUREMENT in CI rather than a claim in a
 * comment — the exact thing the 2026-08-16 set got wrong.
 *
 * Inline for the same reason as the Lab maths above: ~20 lines, and the token layer stays
 * dependency-free. Feed the output to `deltaE2000` — the simulated colours are ordinary sRGB.
 */
function simulateDichromacy(hex: string, kind: 'deutan' | 'protan'): string {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const unlin = (c: number) => {
    const v = Math.min(1, Math.max(0, c));
    return (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;
  };
  const [r, g, b] = hexToRgb(hex).map(lin);
  const L = 17.8824 * r + 43.5161 * g + 4.11935 * b;
  const M = 3.45565 * r + 27.1554 * g + 3.86714 * b;
  const S = 0.0299566 * r + 0.184309 * g + 1.46709 * b;
  const Ld = kind === 'protan' ? 2.02344 * M - 2.52581 * S : L;
  const Md = kind === 'deutan' ? 0.494207 * L + 1.24827 * S : M;
  const out = [
    0.080944 * Ld - 0.130504 * Md + 0.116721 * S,
    -0.0102485 * Ld + 0.0540194 * Md - 0.113615 * S,
    -0.000365294 * Ld - 0.00412163 * Md + 0.693513 * S,
  ].map((c) => Math.round(unlin(c)));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Chroma (distance from the neutral axis) — how "colourful" a hue is at all. */
function chroma(hex: string): number {
  const [, a, b] = toLab(hex);
  return Math.hypot(a, b);
}

/** CIEDE2000 perceptual colour difference. ~1 = just-noticeable; ≥25 = plainly different. */
function deltaE2000(hex1: string, hex2: string): number {
  const [L1, a1, b1] = toLab(hex1);
  const [L2, a2, b2] = toLab(hex2);
  const deg = (r: number) => (r * 180) / Math.PI;
  const rad = (d: number) => (d * Math.PI) / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = C2p === 0 ? 0 : (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  const T =
    1 -
    0.17 * Math.cos(rad(hbp - 30)) +
    0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) -
    0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}
