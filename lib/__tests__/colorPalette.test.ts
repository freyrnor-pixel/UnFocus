/**
 * colorPalette.test.ts — the design-lab picker's colour range, and the HSL pair under it.
 *
 * Two things worth pinning. The conversions must round-trip closely enough that opening the
 * picker on a token and closing it again doesn't quietly shift the colour; and the grid must
 * actually BE a grid — a range whose columns get darker and whose rows stay one hue, because
 * that structure is the only thing that makes it pickable rather than a bag of swatches.
 */
import { hexToHsl, hslToHex } from '@/constants/theme';
import {
  NEUTRAL_LIGHTNESS,
  SWATCH_GRID,
  SWATCH_HUES,
  SWATCH_SHADES,
  SWATCH_VALUES,
} from '@/lib/colorPalette';

const HEX = /^#[0-9a-f]{6}$/;

describe('hexToHsl / hslToHex', () => {
  test.each([
    ['#ffffff', 0, 0, 100],
    ['#000000', 0, 0, 0],
    ['#ff0000', 0, 100, 50],
    ['#00ff00', 120, 100, 50],
    ['#0000ff', 240, 100, 50],
  ])('%s reads as h%i s%i l%i', (hex, h, s, l) => {
    expect(hexToHsl(hex)).toEqual({ h, s, l });
  });

  // Both directions round to whole degrees/percents, so a round trip can move a channel by a
  // point or two. That bound is what the picker relies on to only write on a real interaction
  // — if this ever grew, merely opening the sheet would start nudging colours.
  test.each(['#4f46e5', '#d9a441', '#1e3a8a', '#7f7f7f', '#0f172a', '#f8fafc'])(
    '%s survives a round trip within 2/255 per channel',
    (hex) => {
      const { h, s, l } = hexToHsl(hex);
      const back = hslToHex(h, s, l);
      expect(back).toMatch(HEX);
      const channels = (v: string) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
      const before = channels(hex);
      const after = channels(back);
      before.forEach((v, i) => expect(Math.abs(v - after[i])).toBeLessThanOrEqual(2));
    },
  );

  test('a grey has no hue and no saturation, whichever grey it is', () => {
    ['#000000', '#333333', '#7f7f7f', '#ffffff'].forEach((grey) => {
      const { h, s } = hexToHsl(grey);
      expect(h).toBe(0);
      expect(s).toBe(0);
    });
  });

  test('hue wraps and saturation/lightness clamp rather than producing junk', () => {
    expect(hslToHex(360, 100, 50)).toBe(hslToHex(0, 100, 50));
    expect(hslToHex(-120, 100, 50)).toBe(hslToHex(240, 100, 50));
    expect(hslToHex(200, 500, 50)).toBe(hslToHex(200, 100, 50));
    expect(hslToHex(200, 50, -20)).toBe(hslToHex(200, 50, 0));
  });

  test('every hue produces a valid hex at every stop of the wheel', () => {
    for (let h = 0; h < 360; h += 5) {
      expect(hslToHex(h, 62, 50)).toMatch(HEX);
    }
  });
});

describe('the swatch grid', () => {
  test('is one row per hue plus a neutral row, six shades each', () => {
    expect(SWATCH_GRID).toHaveLength(SWATCH_HUES.length + 1);
    SWATCH_GRID.forEach((row) => expect(row.shades).toHaveLength(SWATCH_SHADES.length));
    expect(SWATCH_GRID[SWATCH_GRID.length - 1].hue).toBeNull();
  });

  test('every swatch is a valid opaque hex', () => {
    SWATCH_VALUES.forEach((hex) => expect(hex).toMatch(HEX));
  });

  // The grid's whole claim is that it is navigable: across is darker, along is one hue.
  test('each row gets strictly darker from left to right', () => {
    SWATCH_GRID.forEach((row) => {
      const lightness = row.shades.map((hex) => hexToHsl(hex).l);
      expect(lightness).toEqual([...lightness].sort((a, b) => b - a));
      expect(new Set(lightness).size).toBe(lightness.length);
    });
  });

  test('each coloured row stays on its own hue', () => {
    SWATCH_GRID.filter((row) => row.hue !== null).forEach((row) => {
      row.shades.forEach((hex) => {
        // ±2° of rounding: the conversion works in whole degrees at both ends.
        expect(Math.abs(hexToHsl(hex).h - (row.hue as number))).toBeLessThanOrEqual(2);
      });
    });
  });

  test('the neutral row is genuinely colourless, not a tinted grey', () => {
    const neutral = SWATCH_GRID[SWATCH_GRID.length - 1];
    neutral.shades.forEach((hex) => expect(hexToHsl(hex).s).toBe(0));
    expect(neutral.shades).toHaveLength(NEUTRAL_LIGHTNESS.length);
  });

  test('no two swatches in the whole grid are the same colour', () => {
    expect(new Set(SWATCH_VALUES).size).toBe(SWATCH_VALUES.length);
  });

  // A pale swatch at mid saturation reads as grey; the taper is what stops the lightest
  // column from being six near-identical washes.
  test('saturation tapers as the shades darken', () => {
    const sats = SWATCH_SHADES.map((s) => s.s);
    expect(sats).toEqual([...sats].sort((a, b) => b - a));
  });
});
