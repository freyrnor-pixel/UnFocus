/**
 * domainColor.test.ts — Tests for the semantic color-coding layer (lib/domainColor.ts).
 *
 * Verifies:
 * (a) every Domain resolves to a non-empty {accent, soft, ink} triad in both modes
 * (b) each domain's `ink` is legible on its `accent` (contrast ≥ 3:1 — icon/UI text level)
 * (c) getStatusColor maps done/overdue/soon to the semantic tokens and default to the domain
 */
import { getDomainColor, getStatusColor, Domain } from '@/lib/domainColor';
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
    });
  });

  it('(c) status → semantic token mapping', () => {
    const theme = getThemePalette('default', false);
    expect(getStatusColor(theme, 'done', 'task').accent).toBe(theme.good);
    expect(getStatusColor(theme, 'overdue', 'task').accent).toBe(theme.bad);
    expect(getStatusColor(theme, 'soon', 'task').accent).toBe(theme.warn);
    // default falls back to the domain accent
    expect(getStatusColor(theme, 'default', 'shop').accent).toBe(theme.featShop);
  });
});
