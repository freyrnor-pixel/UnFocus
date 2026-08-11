/**
 * domainColor.test.ts — Tests for the semantic color-coding layer (lib/domainColor.ts).
 *
 * Verifies:
 * (a) every Domain resolves to a non-empty {accent, soft, ink} triad in both modes
 * (b) each domain's `ink` is legible on BOTH badgeGradient stops (contrast ≥ 3:1 — icon/UI text
 *     level) — checked against the fill it's actually drawn on, not the raw `accent`, since
 *     2026-08-11 the two can differ (see (e))
 * (c) getStatusColor maps done/overdue/soon to the semantic tokens and default to the domain
 * (d) domain accent comes from the card* identity ramp (NOT feat*, which is the screen hue)
 * (e) the gradient primitives (washTop, badgeGradient) derive from the accent + navy deep-stop
 * (f) ink is always white (2026-08-11) — see lib/domainColor.ts's file-header addendum
 * (g) badgeGradientFor() also clears the white floor for every `feat*` SCREEN hue — the set
 *     components/CardAccent.tsx's `accentOverride` actually feeds it (Home's preview cards),
 *     which is a different hue set from the `card*` domain ramp (d) and includes Notes' yellow
 *     and Food's orange, both of which fail unmixed like Shopping's gold does
 */
import { getDomainColor, getStatusColor, Domain, CARD_BADGE_DEEP, badgeGradientFor } from '@/lib/domainColor';
import { getThemePalette, contrastRatio, ThemePalette } from '@/constants/colors';

const DOMAINS: Domain[] = ['task', 'plan', 'habit', 'shop', 'meal', 'budget', 'note', 'health'];

describe('domainColor — semantic color-coding layer', () => {
  [false, true].forEach((isDark) => {
    const mode = isDark ? 'dark' : 'light';
    const theme = getThemePalette('default', isDark);

    describe(`(${mode})`, () => {
      it('(a) resolves a full triad for every domain', () => {
        DOMAINS.forEach((d) => {
          const c = getDomainColor(theme, d);
          expect(c.accent).toMatch(/^#|rgba/);
          expect(c.soft).toContain('rgba');
          expect(c.ink).toMatch(/^#/);
        });
      });

      it('(b) ink is legible on both badge-gradient stops (≥ 3:1)', () => {
        DOMAINS.forEach((d) => {
          const c = getDomainColor(theme, d);
          c.badgeGradient.forEach((stop) => {
            expect(contrastRatio(c.ink, stop)).toBeGreaterThanOrEqual(3);
          });
        });
      });

      it('(f) ink is always white', () => {
        DOMAINS.forEach((d) => {
          expect(getDomainColor(theme, d).ink).toBe('#FFFFFF');
        });
      });

      it('(d) accent comes from the card* ramp, not the feat* screen hue', () => {
        // The two layers are deliberately different: screens keep feat* (green/teal/…),
        // cards use the blue→violet card* ramp. shop is the clearest divergence.
        expect(getDomainColor(theme, 'shop').accent).toBe(theme.cardShop);
        expect(getDomainColor(theme, 'shop').accent).not.toBe(theme.featShop);
        expect(getDomainColor(theme, 'health').accent).toBe(theme.cardHealth);
      });

      it('(e) gradient primitives derive from accent + navy deep-stop', () => {
        // Shopping's gold (and its shop/meal/budget aliases) is the one hue where the raw
        // accent doesn't already support a white glyph — badgeGradientFor() deepens its light
        // stop past the accent to fix that (2026-08-11). Everyone else's light stop is still
        // exactly the accent, unmixed, same as the original 2026-07-19 recipe.
        const DEEPENED: Domain[] = ['shop', 'meal', 'budget'];
        DOMAINS.forEach((d) => {
          const c = getDomainColor(theme, d);
          // washTop is an opaque hex blend (mix returns hex), badgeGradient a 2-stop tuple
          // whose second stop is the navy-shifted darker end.
          expect(c.washTop).toMatch(/^#[0-9a-fA-F]{6}$/);
          expect(c.badgeGradient).toHaveLength(2);
          if (DEEPENED.includes(d)) {
            expect(c.badgeGradient[0]).not.toBe(c.accent);
          } else {
            expect(c.badgeGradient[0]).toBe(c.accent);
          }
          expect(c.badgeGradient[1]).not.toBe(c.accent);
          expect(c.badgeGradient[1]).not.toBe(CARD_BADGE_DEEP);
        });
      });

      it('(g) badgeGradientFor() clears the white floor for every feat* screen hue too', () => {
        // Home's preview cards pass accentOverride=getScreenColor(...).base, i.e. a `feat*`
        // hue, not a `card*` one — badgeGradientFor() has to work for that whole set, not just
        // the four domain hues (b)/(e) cover.
        const p = theme as unknown as Record<string, string>;
        Object.keys(theme as ThemePalette)
          .filter((k) => k.startsWith('feat'))
          .forEach((key) => {
            const [light, dark] = badgeGradientFor(p[key]);
            expect(contrastRatio('#FFFFFF', light)).toBeGreaterThanOrEqual(3);
            expect(contrastRatio('#FFFFFF', dark)).toBeGreaterThanOrEqual(3);
          });
      });
    });
  });

  it('(c) status → semantic token mapping', () => {
    const theme = getThemePalette('default', false);
    expect(getStatusColor(theme, 'done', 'task').accent).toBe(theme.good);
    expect(getStatusColor(theme, 'overdue', 'task').accent).toBe(theme.bad);
    expect(getStatusColor(theme, 'soon', 'task').accent).toBe(theme.warn);
    // default falls back to the domain accent (now the card* ramp, not feat*)
    expect(getStatusColor(theme, 'default', 'shop').accent).toBe(theme.cardShop);
  });
});
