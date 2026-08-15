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

      it('(d) accent comes from the card* ramp', () => {
        // The SOURCE is what this pins: a domain's accent is its `card*` token, never a
        // `feat*` one, regardless of whether the two happen to hold the same value.
        expect(getDomainColor(theme, 'shop').accent).toBe(theme.cardShop);
        expect(getDomainColor(theme, 'health').accent).toBe(theme.cardHealth);

        // ⚠️ Whether the two layers DIVERGE is now mode-dependent, and that is deliberate
        // (2026-08-16). It used to be a flat "they must differ" — screens wore feat*
        // (green/teal/…) while cards wore the card* ramp. The categorical brief §7 aligned
        // the DARK feat* octet onto the same five hues precisely so a screen's 5% pane wash
        // and the badge sitting on it stop disagreeing. Light mode was left on its
        // legibility-tuned octet, so there the old divergence still holds.
        if (isDark) {
          expect(getDomainColor(theme, 'shop').accent).toBe(theme.featShop);
          expect(getDomainColor(theme, 'health').accent).toBe(theme.featHealth);
        } else {
          expect(getDomainColor(theme, 'shop').accent).not.toBe(theme.featShop);
        }
      });

      it('(e) gradient primitives derive from accent + navy deep-stop', () => {
        // Which hues get DEEPENED flipped almost completely in the 2026-08-16 neon pass, and
        // the list is derived rather than typed out so it can't go stale again: a hue is
        // deepened exactly when white does NOT already clear the badge floor on it.
        //
        // Before: Shopping's gold alone (plus its meal/budget/scan aliases) failed, and every
        // other light stop was the raw accent. Under the 2026-08-16 neons the set was the
        // opposite — all bright, so only Health's rose (`#FF2A6D`, 3.62) cleared unmixed.
        // Since the 2026-08-17 lightness ladder it is **Notes** (`#B45CFF`, 3.55): the ladder
        // put Health's rose up at L* 71.7, where white measures 2.18, and left Notes as the
        // darkest rung. So the identity of the exception tracks whichever hue is at the BOTTOM
        // of the band, which is the honest way to read this pin — not a claim about rose.
        // Everything else starts already-mixed toward the navy deep-stop. That is
        // `badgeGradientFor` working as designed under a brighter palette, not a regression:
        // the assertion that matters is (b) above, which checks the white glyph on both stops.
        const clearsWhiteUnmixed = (d: Domain) =>
          contrastRatio('#FFFFFF', getDomainColor(theme, d).accent) >= 3.3;
        // Pinned so "every hue is deepened" (i.e. the derivation silently doing nothing
        // interesting) would still be caught.
        expect(DOMAINS.filter(clearsWhiteUnmixed)).toEqual(['note']);
        DOMAINS.forEach((d) => {
          const c = getDomainColor(theme, d);
          // washTop is an opaque hex blend (mix returns hex), badgeGradient a 2-stop tuple
          // whose second stop is the navy-shifted darker end.
          expect(c.washTop).toMatch(/^#[0-9a-fA-F]{6}$/);
          expect(c.badgeGradient).toHaveLength(2);
          if (clearsWhiteUnmixed(d)) {
            expect(c.badgeGradient[0]).toBe(c.accent);
          } else {
            expect(c.badgeGradient[0]).not.toBe(c.accent);
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
