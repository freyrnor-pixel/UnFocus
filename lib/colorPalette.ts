/**
 * colorPalette.ts — the range of colours the design lab's picker offers.
 *
 * The lab shipped (2026-08-06) with hex typing and a ±8% lighten/darken pair as the only way
 * to change a colour, which answers "a bit darker" and nothing else — there was no way to ask
 * for a different hue at all without already knowing the code you wanted. This is the other
 * half: a fixed, generated range to pick from, so choosing a colour is a tap.
 *
 * **Generated, not curated.** Every swatch is `hslToHex` of a declared hue × a declared shade,
 * so the grid is data rather than a hand-written list of hex codes that would drift out of any
 * relationship with each other. That is also what keeps it honest as a *range*: the columns
 * really are one hue getting darker, and the rows really are the same six brightnesses.
 *
 * Connections:
 *   Imports → constants/theme (hslToHex)
 *   Used by → components/ColorPickerSheet.tsx, lib/__tests__/colorPalette.test.ts
 *   Data    → none (pure — a fixed table in, hex strings out)
 *
 * Edit notes:
 *   - **A row is a hue and a column is a shade, and the layout depends on it.** The picker
 *     draws one row per hue with the six shades across it, so every swatch is a full-width-
 *     share tap target. A grid transposed to hue-per-column puts twelve 26px cells on a 360px
 *     phone, which is under half a tap target — that was the reason for this shape.
 *   - **Saturation tapers with lightness on purpose.** A pale colour at the same saturation as
 *     a mid one reads as grey, and a very dark one reads as mud. The taper is what makes the
 *     lightest column still look like the hue it belongs to.
 *   - The neutral row is `s: 0`, not a near-grey. The app's own greys are palette tokens with
 *     a deliberate blue cast; offering a *second* set of tinted greys here would make it
 *     impossible to pick a true neutral, which is the one thing this row is for.
 */
import { hslToHex } from '@/constants/theme';

/** The hue wheel, in degrees, spread to cover the families the app actually uses. */
export const SWATCH_HUES: readonly number[] = [4, 30, 45, 140, 170, 200, 224, 250, 280, 330];

/** The six brightness stops every hue is offered at, lightest first. */
export const SWATCH_SHADES: readonly { l: number; s: number }[] = [
  { l: 90, s: 72 },
  { l: 78, s: 70 },
  { l: 64, s: 66 },
  { l: 50, s: 62 },
  { l: 36, s: 58 },
  { l: 24, s: 55 },
];

/** The greys, at the same six stops. `null` hue marks the row as having no colour. */
export const NEUTRAL_LIGHTNESS: readonly number[] = [96, 80, 62, 44, 26, 10];

export type SwatchRow = {
  /** The row's hue in degrees, or `null` for the neutral row. */
  hue: number | null;
  /** Six hex values, lightest first. */
  shades: string[];
};

/**
 * The whole grid: one row per hue, then the neutrals.
 *
 * Built once at module scope — it is a fixed table, and rebuilding it per render would
 * allocate 66 strings on every frame of a slider drag happening in the same sheet.
 */
export const SWATCH_GRID: readonly SwatchRow[] = [
  ...SWATCH_HUES.map((hue) => ({
    hue,
    shades: SWATCH_SHADES.map((shade) => hslToHex(hue, shade.s, shade.l)),
  })),
  { hue: null, shades: NEUTRAL_LIGHTNESS.map((l) => hslToHex(0, 0, l)) },
];

/** Every swatch, flattened — for "is this colour one of ours?" checks. */
export const SWATCH_VALUES: readonly string[] = SWATCH_GRID.flatMap((row) => row.shades);
