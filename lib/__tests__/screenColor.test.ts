/**
 * screenColor.test.ts — per-screen hue mapping (lib/screenColor.ts).
 *
 * **Rewritten 2026-08-05 for the card design reset.** This file previously pinned the
 * retired (2026-07-31, A.5) day-arc mapping — shopping=green, plans=indigo, home=blue,
 * health=teal, habits=violet — and asserted that unknown routes fell back to `accent`.
 * Both changed when the maintainer brought the per-screen hue back as the card border:
 * every screen now takes the token that matches its own domain, Home and Settings
 * deliberately have NO hue, and an unknown route lands on the neutral `theme.border`
 * rather than on the action colour.
 *
 * What's worth pinning here, and why each one is a real regression risk:
 *   - the exact screen → token mapping (a wrong pairing is invisible in review — every
 *     screen still looks "coloured", just wrong, exactly like the tab-order/backdrop-panel
 *     bug lib/__tests__/motifs.test.ts exists to catch);
 *   - that Home and Settings are neutral (the whole "Home is an index of the others"
 *     design collapses if Home grows a hue of its own);
 *   - that an unknown route is NEUTRAL and specifically not `accent` (the accent means
 *     "you can press this", so a card wearing it lies about being tappable);
 *   - that the hues are mutually distinct (two screens sharing a border colour is the
 *     failure this whole layer is meant to prevent).
 */
import { getThemePalette } from '@/constants/colors';
import { getScreenColor } from '@/lib/screenColor';

const light = getThemePalette('default', false);
const dark = getThemePalette('default', true);

describe('getScreenColor', () => {
  it('maps each screen to its own domain token (light)', () => {
    expect(getScreenColor(light, 'plans').base).toBe(light.featTask);
    expect(getScreenColor(light, 'habits').base).toBe(light.featHabit);
    expect(getScreenColor(light, 'health').base).toBe(light.featHealth);
    expect(getScreenColor(light, 'shopping').base).toBe(light.featShop);
    expect(getScreenColor(light, 'notes').base).toBe(light.featNote);
    expect(getScreenColor(light, 'food').base).toBe(light.featMeal);
    expect(getScreenColor(light, 'scan').base).toBe(light.featScan);
    expect(getScreenColor(light, 'goals').base).toBe(light.featPlan);
  });

  it('maps the same way in dark mode', () => {
    expect(getScreenColor(dark, 'plans').base).toBe(dark.featTask);
    expect(getScreenColor(dark, 'shopping').base).toBe(dark.featShop);
    expect(getScreenColor(dark, 'goals').base).toBe(dark.featPlan);
  });

  it('Home and Settings deliberately have NO hue', () => {
    // Home's preview cards wear their SOURCE screen's colour instead, so Home reads as an
    // index of the other screens rather than as a sixth one. Settings is chrome, not a
    // domain. Both must stay neutral — see lib/screenColor.ts's header.
    for (const route of ['index', 'home', 'settings']) {
      expect(getScreenColor(light, route).base).toBe(light.border);
      expect(getScreenColor(light, route).neutral).toBe(true);
    }
  });

  it("'home' is an alias for 'index'", () => {
    expect(getScreenColor(light, 'home').base).toBe(getScreenColor(light, 'index').base);
    expect(getScreenColor(dark, 'home').base).toBe(getScreenColor(dark, 'index').base);
  });

  it('the eight hued screens are all distinct', () => {
    const hues = ['plans', 'habits', 'health', 'shopping', 'notes', 'food', 'scan', 'goals']
      .map((r) => getScreenColor(light, r).base);
    expect(new Set(hues).size).toBe(8);
  });

  it('an unknown route is NEUTRAL, not the accent', () => {
    // `accent` means "you can act on this". A card border in the accent reads as tappable
    // when it isn't, which is why the old fallback was wrong and this one is not.
    for (const route of ['nonsense-route', undefined, null]) {
      const hue = getScreenColor(light, route);
      expect(hue.base).toBe(light.border);
      expect(hue.base).not.toBe(light.accent);
      expect(hue.neutral).toBe(true);
    }
  });

  it('a hued screen is not marked neutral', () => {
    expect(getScreenColor(light, 'shopping').neutral).toBe(false);
  });

  it('soft is a translucent tint of the base', () => {
    const { base, soft } = getScreenColor(light, 'shopping');
    expect(soft).toContain('rgba(');
    expect(soft).toContain('0.14');
    expect(base).toMatch(/^#/);
  });
});
