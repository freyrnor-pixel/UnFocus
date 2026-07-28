/**
 * personColor.test.ts — the person identity colour channel (2026-07-28).
 *
 * Pins the two rules that make person colour safe to draw next to everything else on a
 * row: it never collides with the status colours (green/red/amber are reserved for
 * done/overdue/soon everywhere in this app), and it resolves deterministically so two
 * paired phones show the same person in the same hue.
 */
import {
  PERSON_PALETTE,
  isHexColor,
  paletteColorAt,
  personColor,
  personInitials,
  personTriad,
} from '@/lib/personColor';
import { getThemePalette } from '@/constants/colors';

describe('PERSON_PALETTE', () => {
  test('every entry is a parseable hex colour', () => {
    // constants/theme's rgba()/contrastOn() call hexToRgb, which produces NaN on anything
    // else — a bad entry would render as an invalid style value rather than throwing.
    for (const hex of PERSON_PALETTE) expect(isHexColor(hex)).toBe(true);
  });

  test('entries are distinct', () => {
    expect(new Set(PERSON_PALETTE).size).toBe(PERSON_PALETTE.length);
  });

  test('never reuses a status hue', () => {
    // The whole point of the palette's empty arc (16° → 180°): a green person dot sitting
    // next to a green "done" rail reads as a state, not an identity.
    const light = getThemePalette('default', false);
    const dark = getThemePalette('default', true);
    const reserved = [
      light.good, light.bad, light.warn,
      dark.good, dark.bad, dark.warn,
    ].map((c) => c.toLowerCase());
    for (const hex of PERSON_PALETTE) {
      expect(reserved).not.toContain(hex.toLowerCase());
    }
  });
});

describe('paletteColorAt', () => {
  test('wraps past the end of the palette', () => {
    expect(paletteColorAt(PERSON_PALETTE.length)).toBe(PERSON_PALETTE[0]);
    expect(paletteColorAt(PERSON_PALETTE.length + 2)).toBe(PERSON_PALETTE[2]);
  });

  test('handles a negative index without returning undefined', () => {
    // cycleColor() in Settings passes indexOf(current) + 1, and indexOf is -1 for a colour
    // that isn't in the palette (an older row, a hand-edited backup) — which lands here as 0.
    expect(PERSON_PALETTE).toContain(paletteColorAt(-1));
    expect(paletteColorAt(-1 + 1)).toBe(PERSON_PALETTE[0]);
  });

  test('is deterministic — the same slot always gives the same hue', () => {
    expect(paletteColorAt(3)).toBe(paletteColorAt(3));
  });
});

describe('personColor', () => {
  test('prefers the stored hex so a learned colour survives a palette change', () => {
    expect(personColor('#123456', 0)).toBe('#123456');
  });

  test('falls back to the palette slot for the empty column default', () => {
    expect(personColor('', 1)).toBe(PERSON_PALETTE[1]);
    expect(personColor(undefined, 1)).toBe(PERSON_PALETTE[1]);
  });

  test('falls back rather than passing junk through to a style value', () => {
    expect(personColor('rebeccapurple', 0)).toBe(PERSON_PALETTE[0]);
    expect(personColor('#12345', 0)).toBe(PERSON_PALETTE[0]);
  });

  test('accepts 3-digit hex', () => {
    expect(personColor('#abc', 0)).toBe('#abc');
  });
});

describe('personTriad', () => {
  test('produces an ink colour that is not the accent itself', () => {
    const { accent, ink, soft } = personTriad(PERSON_PALETTE[0], 0);
    expect(accent).toBe(PERSON_PALETTE[0]);
    expect(ink).not.toBe(accent);
    expect(soft).toMatch(/^rgba\(/);
  });
});

describe('personInitials', () => {
  test('one word gives one letter, two words give two', () => {
    expect(personInitials('Sam')).toBe('S');
    expect(personInitials('Anne Berit')).toBe('AB');
  });

  test('ignores extra words and stray whitespace', () => {
    expect(personInitials('  anne   berit   hansen ')).toBe('AB');
  });

  test('empty or whitespace-only gives no initials, so the caller can draw its glyph', () => {
    expect(personInitials('')).toBe('');
    expect(personInitials('   ')).toBe('');
  });

  test('keeps a whole astral-plane character instead of half a surrogate pair', () => {
    // charAt(0) would return a lone high surrogate here and render as a replacement box.
    expect(personInitials('😀 Sam')).toBe('😀S');
  });
});
