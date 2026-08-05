/**
 * borderRamp.test.ts — the card design reset's border tokens (constants/theme.ts).
 *
 * `computeBorderRamp` / `computeBorderTone` / `BORDER_WIDTH` replaced the glass rim as the
 * only place colour touches a card (2026-08-05). What matters about them isn't a specific
 * hex — those are tuning values and should be free to move — but the RELATIONSHIPS the
 * design depends on, which is what this pins:
 *
 *   - the ramp actually ramps (two different stops, so "green to light green" is visible);
 *   - the weight family is ordered card > field > button in both thickness and strength, so
 *     a card full of bordered rows and option cells reads as a hierarchy and not as a grid —
 *     this is the single most load-bearing property of the whole layer;
 *   - `computeBorderTone` sits inside its own weight's ramp, so a plain-bordered field
 *     (FormControls' Input) and a gradient-bordered row look like the same system;
 *   - dark mode LIGHTENS instead of darkening, since a darkened hue on a near-black surface
 *     is an invisible edge rather than a subtle one.
 */
import { BORDER_WIDTH, computeBorderRamp, computeBorderTone } from '@/constants/theme';

/** Pull the mean channel value out of an `rgba(r, g, b, a)` string — a crude lightness proxy. */
function lightnessOf(rgba: string): number {
  const nums = rgba.replace(/[^\d.,]/g, '').split(',').map(Number);
  const [r, g, b] = nums;
  return (r + g + b) / 3;
}

function alphaOf(rgba: string): number {
  const nums = rgba.replace(/[^\d.,]/g, '').split(',').map(Number);
  return nums[3];
}

const HUE = '#3DAF6F'; // featShop green — the maintainer's own "green to light green" example.

describe('computeBorderRamp', () => {
  it('ramps: the two stops are different colours', () => {
    const { colors } = computeBorderRamp(HUE, false, 'card');
    expect(colors[0]).not.toBe(colors[1]);
  });

  it('runs deep → light down the edge in light mode', () => {
    const { colors } = computeBorderRamp(HUE, false, 'card');
    expect(lightnessOf(colors[0])).toBeLessThan(lightnessOf(colors[1]));
  });

  it('lightens rather than darkens in dark mode', () => {
    // A darkened hue on a near-black surface is an invisible edge. Both dark-mode stops must
    // sit above their light-mode counterparts, or a dark card has no visible border at all.
    const lightRamp = computeBorderRamp(HUE, false, 'card');
    const darkRamp = computeBorderRamp(HUE, true, 'card');
    expect(lightnessOf(darkRamp.colors[0])).toBeGreaterThan(lightnessOf(lightRamp.colors[0]));
    expect(lightnessOf(darkRamp.colors[1])).toBeGreaterThan(lightnessOf(lightRamp.colors[1]));
  });

  it('spans the full edge', () => {
    const { locations } = computeBorderRamp(HUE, false, 'card');
    expect(locations[0]).toBe(0);
    expect(locations[locations.length - 1]).toBe(1);
  });

  it('is a valid LinearGradient input at every weight', () => {
    for (const weight of ['card', 'field', 'button'] as const) {
      const ramp = computeBorderRamp(HUE, false, weight);
      // expo-linear-gradient requires ≥2 stops and matching lengths.
      expect(ramp.colors.length).toBeGreaterThanOrEqual(2);
      expect(ramp.locations.length).toBe(ramp.colors.length);
    }
  });
});

describe('the weight family (card → field → button)', () => {
  it('steps DOWN in strength as the element gets smaller', () => {
    // This is the "green → light green across elements" half of the maintainer's spec, and
    // the reason a card containing five bordered rows doesn't read as a table. If this ever
    // inverts, the rows shout louder than the card that holds them.
    const card = alphaOf(computeBorderTone(HUE, false, 'card'));
    const field = alphaOf(computeBorderTone(HUE, false, 'field'));
    const button = alphaOf(computeBorderTone(HUE, false, 'button'));
    expect(card).toBeGreaterThan(field);
    expect(field).toBeGreaterThan(button);
  });

  it('steps DOWN in thickness the same way', () => {
    expect(BORDER_WIDTH.card).toBeGreaterThan(BORDER_WIDTH.field);
    expect(BORDER_WIDTH.field).toBeGreaterThanOrEqual(BORDER_WIDTH.button);
  });

  it('keeps every rung visible — no weight collapses to nothing', () => {
    for (const weight of ['card', 'field', 'button'] as const) {
      expect(BORDER_WIDTH[weight]).toBeGreaterThan(0);
      expect(alphaOf(computeBorderTone(HUE, false, weight))).toBeGreaterThan(0.25);
    }
  });
});

describe('computeBorderTone', () => {
  it('sits between its own weight’s two ramp stops', () => {
    // A flat-bordered field (FormControls' Input, a chip) has to look like it belongs to the
    // same system as a gradient-bordered row, which only holds if the flat tone samples that
    // same ramp rather than being tuned separately.
    const { colors } = computeBorderRamp(HUE, false, 'field');
    const tone = lightnessOf(computeBorderTone(HUE, false, 'field'));
    expect(tone).toBeGreaterThan(lightnessOf(colors[0]));
    expect(tone).toBeLessThan(lightnessOf(colors[1]));
  });

  it('matches its ramp’s alpha at the same weight', () => {
    for (const weight of ['card', 'field', 'button'] as const) {
      const ramp = computeBorderRamp(HUE, false, weight);
      expect(alphaOf(computeBorderTone(HUE, false, weight))).toBeCloseTo(alphaOf(ramp.colors[0]), 5);
    }
  });

  it('returns an rgba string, not a bare hex', () => {
    // Callers pass this straight to a View's `borderColor`; a bare hex would silently drop
    // the per-weight alpha that carries the whole family gradation.
    expect(computeBorderTone(HUE, false, 'card')).toMatch(/^rgba\(/);
  });

  it('defaults to the card weight', () => {
    expect(computeBorderTone(HUE, false)).toBe(computeBorderTone(HUE, false, 'card'));
  });
});
