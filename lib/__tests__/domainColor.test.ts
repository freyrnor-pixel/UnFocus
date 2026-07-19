/**
 * domainColor.test.ts — Tests for the semantic color-coding layer (lib/domainColor.ts).
 *
 * Verifies:
 * (a) every Domain resolves to a non-empty {accent, soft, ink} triad in both modes
 * (b) each domain's `ink` is legible on its `accent` (contrast ≥ 3:1 — icon/UI text level)
 * (c) getStatusColor maps done/overdue/soon to the semantic tokens and default to the domain
 * (d) domain accent comes from the card* identity ramp (NOT feat*, which is the screen hue)
 * (e) the gradient primitives (washTop, badgeGradient) derive from the accent + navy deep-stop
 */
import { getDomainColor, getStatusColor, Domain, CARD_BADGE_DEEP } from '@/lib/domainColor';
import { getThemePalette, contrastRatio } from '@/constants/colors';

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

      it('(b) ink is legible on the domain accent (≥ 3:1)', () => {
        DOMAINS.forEach((d) => {
          const c = getDomainColor(theme, d);
          expect(contrastRatio(c.ink, c.accent)).toBeGreaterThanOrEqual(3);
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
        DOMAINS.forEach((d) => {
          const c = getDomainColor(theme, d);
          // washTop is an opaque hex blend (mix returns hex), badgeGradient a 2-stop tuple
          // whose first stop IS the accent and whose second is the navy-shifted darker end.
          expect(c.washTop).toMatch(/^#[0-9a-fA-F]{6}$/);
          expect(c.badgeGradient).toHaveLength(2);
          expect(c.badgeGradient[0]).toBe(c.accent);
          expect(c.badgeGradient[1]).not.toBe(c.accent);
          expect(c.badgeGradient[1]).not.toBe(CARD_BADGE_DEEP);
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
