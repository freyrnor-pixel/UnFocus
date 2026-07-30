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
 */

import { THEMES, ThemeName, contrastRatio, getThemePalette } from '@/constants/colors';
import { contrastOn } from '@/constants/theme';

const THEME_NAMES: ThemeName[] = ['default'];

const REQUIRED_TOKENS = [
  'bg', 'surface', 'surfaceMuted', 'surfaceInset',
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

    MODES.forEach((mode) => {
      TEXT_COLOURS.forEach((token) => {
        test(`${mode}: ${token} ≥ 4.5:1 as text on both bg and surface`, () => {
          const p = THEMES.default[mode];
          expect(contrastRatio(p[token], p.bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p[token], p.surface)).toBeGreaterThanOrEqual(4.5);
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

      test(`${mode}: accentInk ≥ 4.5:1 on accent`, () => {
        const p = THEMES.default[mode];
        expect(contrastRatio(p.accentInk, p.accent)).toBeGreaterThanOrEqual(4.5);
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
