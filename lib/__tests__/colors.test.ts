/**
 * colors.test.ts — Tests for Decision 006 colour theme token layer
 *
 * Verifies:
 * (a) All six themes expose the full token set in both light and dark modes
 *     (no missing keys)
 * (b) WCAG AA contrast compliance: text and textMuted ≥ 4.5:1 against both bg and surface
 * (c) Dark-mode depth ordering: border > surface > bg (lighter values)
 */

import { THEMES, ThemeName, contrastRatio, getThemePalette } from '@/constants/colors';

const THEME_NAMES: ThemeName[] = ['default', 'summer', 'nature', 'fluffyPink', 'gothic', 'blackWhite'];

const REQUIRED_TOKENS = [
  'bg', 'surface', 'surfaceMuted', 'surfaceInset',
  'text', 'textMuted', 'textInverse',
  'border', 'borderStrong',
  'accent', 'accentSoft', 'accentInk',
  'good', 'goodSoft', 'bad', 'badSoft', 'warn', 'warnSoft',
  'shadow', 'overlay',
  'hintBg', 'hintBorder', 'hintAccent',
  'featTask', 'featPlan', 'featHabit', 'featShop', 'featMeal', 'featBudget', 'featNote', 'featHealth',
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
