/**
 * screenColor.test.ts — per-screen hue mapping (lib/screenColor.ts).
 *
 * Verifies each of the 5 tab routes resolves to its intended dominant hue (day-arc:
 * shopping=green, plans=indigo, home=blue, health=teal, scan=violet), that the 'home'
 * alias matches 'index', that the five hues are all distinct, and that unknown/sub-tier
 * routes fall back to the calm `accent`.
 */
import { getThemePalette } from '@/constants/colors';
import { getScreenColor } from '@/lib/screenColor';

const light = getThemePalette('default', false);
const dark = getThemePalette('default', true);

describe('getScreenColor', () => {
  it('maps each tab route to its palette feat token (light)', () => {
    expect(getScreenColor(light, 'shopping').base).toBe(light.featShop);
    expect(getScreenColor(light, 'plans').base).toBe(light.featPlan);
    expect(getScreenColor(light, 'index').base).toBe(light.featTask);
    expect(getScreenColor(light, 'health').base).toBe(light.featHealth);
    expect(getScreenColor(light, 'scan').base).toBe(light.featScan);
  });

  it("'home' is an alias for 'index' (blue)", () => {
    expect(getScreenColor(light, 'home').base).toBe(getScreenColor(light, 'index').base);
    expect(getScreenColor(dark, 'home').base).toBe(dark.featTask);
  });

  it('the five screen hues are all distinct', () => {
    const hues = ['shopping', 'plans', 'index', 'health', 'scan'].map((r) => getScreenColor(light, r).base);
    expect(new Set(hues).size).toBe(5);
  });

  it('unknown / sub-tier routes fall back to the calm accent', () => {
    expect(getScreenColor(light, 'settings').base).toBe(light.accent);
    expect(getScreenColor(light, undefined).base).toBe(light.accent);
    expect(getScreenColor(light, null).base).toBe(light.accent);
  });

  it('soft is a translucent tint of the base', () => {
    const { base, soft } = getScreenColor(light, 'shopping');
    expect(soft).toContain('rgba(');
    expect(soft).toContain('0.14');
    expect(base).toMatch(/^#/);
  });
});
