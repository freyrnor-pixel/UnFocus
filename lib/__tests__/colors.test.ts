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

    // ⚠️ RELAXED for dark only, 2026-08-10 (true-black palette). `bad` is #EF4444 verbatim
    // from the design review and measures 4.430:1 on `surface` — 0.07 short of AA. The hex
    // was kept on instruction rather than nudged, so the floor moved instead, and only far
    // enough to admit that one value. Light stays at 4.5. If `bad` is ever retuned, put this
    // back to 4.5 rather than leaving a floor nothing needs.
    const CHROMATIC_FLOOR = { light: 4.5, dark: 4.4 } as const;

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
    // rule 10b). Dark is untouched at 1.20 and still measures 1.260, because its glass alpha
    // was chosen to composite to exactly the `#1E1E1E` it already had.
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
        // Dark is byte-identical to the true-black pass — its glass alpha was picked so the
        // composite lands on the `#1E1E1E` it already had, so nothing below it moved.
        const expected = mode === 'light'
          ? { bgSurface: 1.170, ladderA: 1.138, ladderB: 1.118, rule: 1.347 }
          : { bgSurface: 1.260, ladderA: 1.124, ladderB: 1.057, rule: 1.119 };
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
    test('dark: body text sits INSIDE the 7–16:1 halation band on surface', () => {
      const p = THEMES.default.dark;
      const ratio = contrastRatio(p.text, p.surface);
      expect(ratio).toBeGreaterThanOrEqual(7);
      expect(ratio).toBeLessThanOrEqual(16);
    });

    // ── A.3/A.6 · the four identity hues ────────────────────────────────────────────────
    const HUE_KEYS = ['todo', 'habits', 'health', 'shopping'] as const;
    // The lightnesses the set was designed around. Pinned so a future "let's harmonise the
    // badges" pass fails loudly here instead of silently destroying the greyscale channel.
    // `habits` moved 44.8 → 48.3 on 2026-08-04 when `#1F7A2E` was lightened to `#218432`
    // (DESIGN_COMPARISON/06's recorded-but-declined candidate, applied on the maintainer's
    // overrule). That is the ONLY value that has moved; re-pinning it is exactly the "blast
    // radius" the decline was worried about, and it was this one line.
    const DOCUMENTED_LSTAR: Record<(typeof HUE_KEYS)[number], number> = {
      todo: 38.6,
      habits: 48.3,
      health: 44.3,
      shopping: 70.7,
    };

    HUE_KEYS.forEach((key) => {
      const { hue, ink } = IDENTITY_HUES[key];

      // A.6 #1 — text on an identity-badge FILL clears AA. This is the ink the app actually
      // draws: contrastOn() picks it, and the declared `ink` in IDENTITY_HUES records that
      // same choice so a human reading the table sees what the code computes.
      test(`identity ${key}: declared badge ink matches contrastOn() and clears AA on the fill`, () => {
        expect(contrastRatio(ink, hue)).toBeGreaterThanOrEqual(4.5);
        // Same family (dark-vs-white), not necessarily the same hex — contrastOn returns the
        // theme's own near-black, the table records the palette's `text`.
        const picked = contrastOn(hue);
        expect(picked === '#FFFFFF').toBe(ink === '#FFFFFF');
      });

      // A.6 #5 — the L* drift guard.
      test(`identity ${key}: L* has not drifted from its documented value`, () => {
        expect(lstar(hue)).toBeCloseTo(DOCUMENTED_LSTAR[key], 0);
      });
    });

    // A.6 #2 — every pair is separable.
    test('identity hues: every pair is ΔE2000 ≥ 25 or L* apart ≥ 15', () => {
      for (let i = 0; i < HUE_KEYS.length; i += 1) {
        for (let j = i + 1; j < HUE_KEYS.length; j += 1) {
          const a = IDENTITY_HUES[HUE_KEYS[i]].hue;
          const b = IDENTITY_HUES[HUE_KEYS[j]].hue;
          const separated = deltaE2000(a, b) >= 25 || Math.abs(lstar(a) - lstar(b)) >= 15;
          expect(`${HUE_KEYS[i]}/${HUE_KEYS[j]}: ${separated}`).toBe(`${HUE_KEYS[i]}/${HUE_KEYS[j]}: true`);
        }
      }
    });

    // A.6 #5, the greyscale half of it. NOTE ON SCOPE — read before "tightening" this:
    // a literal "no identity hue's L* may come within 15 of another's" is UNSATISFIABLE for
    // this set and always was. Four values pairwise ≥15 apart need a ≥45 L* span; the
    // mandated hues span 38.6→70.7 = 32.1, and Habits/Health are 4.0 apart (0.5 before the
    // 2026-08-04 Habits lightening, which widened it as a side effect rather than as a goal —
    // they still separate by hue, at ΔE2000 63.1, asserted above). What the L* channel carries
    // is Shopping standing clear of the other three — that is the gap that survives greyscale
    // and colour blindness, and the reason Shopping alone takes dark ink. That is what is
    // guarded here, plus the per-hue drift pin above.
    test('identity hues: Shopping keeps a ≥15 L* gap from every other hue', () => {
      const shop = lstar(IDENTITY_HUES.shopping.hue);
      (['todo', 'habits', 'health'] as const).forEach((key) => {
        expect(Math.abs(shop - lstar(IDENTITY_HUES[key].hue))).toBeGreaterThanOrEqual(15);
      });
    });

    // The neutral must not become a fifth identity: near-zero chroma is what makes it read
    // as "no colour assigned" rather than as a quiet hue of its own.
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

      test(`${mode}: the raw hue is NOT safe on the plate for at least one identity hue`, () => {
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

    // The nine surviving token names must keep resolving to the four values + the neutral,
    // in both modes — this is the revertable-alias contract from constants/colors.ts.
    test('the nine card* names alias exactly four hues plus the neutral', () => {
      const expectedMap: Record<string, string> = {
        cardPlan: IDENTITY_HUES.todo.hue,
        cardTask: IDENTITY_HUES.todo.hue,
        cardHabit: IDENTITY_HUES.habits.hue,
        cardHealth: IDENTITY_HUES.health.hue,
        cardMeal: IDENTITY_HUES.shopping.hue,
        cardShop: IDENTITY_HUES.shopping.hue,
        cardBudget: IDENTITY_HUES.shopping.hue,
        cardScan: IDENTITY_HUES.shopping.hue,
        cardNote: IDENTITY_NEUTRAL,
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
    const MEAL_COLORS: Record<string, { light: string; dark: string }> = {
      breakfast: { light: '#B45309', dark: '#D49B70' },
      lunch: { light: '#0F766E', dark: '#79B2AE' },
      dinner: { light: '#9A3412', dark: '#C8917F' },
      snack: { light: '#7E22CE', dark: '#B27AE2' },
      kveldsmat: { light: '#4338CA', dark: '#8E88DF' },
    };

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
