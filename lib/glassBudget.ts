/**
 * glassBudget.ts — how much light the backdrop may put under a card.
 *
 * **Why this file exists.** `components/Surface.tsx` paints a card with `theme.surfaceGlass`, a
 * translucent fill, and `theme.surface` is that fill ALREADY COMPOSITED over the backdrop — the
 * colour every contrast assertion in the app measures against. Dark's alpha (0.1412) was derived
 * on the premise that the ground under a card is pure `#000000`, which was true while
 * `components/ScreenBackground.tsx` anchored its washes at the corners. It stopped being true on
 * 2026-09-06, when v2's geometry carried them across the frame — and at 0.1412 the pane transmits
 * **86%**, so the card started painting a colour its own contrast system was not measuring.
 *
 * That was caught, and the fix taken at the time was to make the pane OPAQUE, which made every
 * assertion true by construction and removed the material the brief is about. This module takes
 * the other route: bound the GROUND instead, so the composite stays inside the band the contrast
 * rules already define and the pane can go on transmitting.
 *
 * ⚠️ **The band is two-sided, and the upper bound is the one that surprises people.** A card that
 * gets too light fails AA on `textMuted`; a card that gets too DARK fails DESIGN_RULES.md rule
 * 10a's halation ceiling, which caps `text`-on-`surface` at 17:1 (pure white on near-black
 * smears on OLED). So this is a window, not a floor — see `cardLuminanceBand`.
 *
 * ⚠️ **This is a MODEL of the render, not the render.** It assumes the ground reaching a card is
 * the backdrop alone. That holds for an `ambient` card, which is the tier that transmits; it does
 * NOT hold for `overlay`/`nav`, which are opaque precisely because the app's own cards are behind
 * them. Don't extend this to those tiers — bound them by keeping them opaque, as today.
 *
 * Connections:
 *   Imports → (nothing — pure arithmetic, deliberately dependency-free so the test can run it
 *             against constants/colors.ts values without pulling in React Native)
 *   Used by → lib/__tests__/glassBudget.test.ts (samples the real wash field against it),
 *             components/ScreenBackground.tsx (its palette doc cites the derived ceiling)
 *   Data    → none
 */

export type RGB = readonly [number, number, number];

/** Parse `#RRGGBB`. Throws on anything else — every caller passes a literal from the palette. */
export function parseHex(hex: string): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`glassBudget: expected #RRGGBB, got ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. */
export function relativeLuminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Source-over composite of `src` at `alpha` onto opaque `dst`. */
export function compositeOver(dst: RGB, src: RGB, alpha: number): RGB {
  return [
    src[0] * alpha + dst[0] * (1 - alpha),
    src[1] * alpha + dst[1] * (1 - alpha),
    src[2] * alpha + dst[2] * (1 - alpha),
  ];
}

/**
 * The three constraints a painted card must satisfy, named so a failure says which one broke.
 *
 * These are not invented here — each is already binding somewhere in the repo, and this file is
 * the first place they are applied to the card's ACTUAL painted colour rather than to the
 * `theme.surface` token that stands in for it.
 */
export const CARD_CONSTRAINTS = {
  /** DESIGN_RULES.md rule 10a: the halation band for body text on a card. */
  textMin: 7,
  textMax: 17,
  /** WCAG 2.1 AA for secondary text. */
  textMutedMin: 4.5,
  /** WCAG 2.1 SC 1.4.11 for a non-text boundary. */
  borderMin: 3,
} as const;

export type CardTokens = { text: string; textMuted: string; border: string };

/** Does this painted card colour satisfy all three? Returns the failing constraint, or null. */
export function cardFailure(card: RGB, tokens: CardTokens): string | null {
  const t = contrastRatio(parseHex(tokens.text), card);
  const m = contrastRatio(parseHex(tokens.textMuted), card);
  const b = contrastRatio(parseHex(tokens.border), card);
  if (t < CARD_CONSTRAINTS.textMin) return `text ${t.toFixed(2)}:1 < ${CARD_CONSTRAINTS.textMin}`;
  if (t > CARD_CONSTRAINTS.textMax) return `text ${t.toFixed(2)}:1 > ${CARD_CONSTRAINTS.textMax} (halation)`;
  if (m < CARD_CONSTRAINTS.textMutedMin) return `textMuted ${m.toFixed(2)}:1 < ${CARD_CONSTRAINTS.textMutedMin}`;
  if (b < CARD_CONSTRAINTS.borderMin) return `border ${b.toFixed(2)}:1 < ${CARD_CONSTRAINTS.borderMin}`;
  return null;
}

/**
 * The neutral-grey window a painted card may occupy, as raw 0-255 levels.
 *
 * Scanned rather than solved: the three constraints are monotonic in luminance but their
 * crossings are not worth deriving in closed form, and a scan is exact at the resolution the
 * value is stored in. On dark's tokens this returns 29-64 — today's `#242424` (36) sits near the
 * dark end, which is why there is room to let the backdrop in but very little to make cards
 * darker.
 */
export function cardLuminanceBand(tokens: CardTokens): { min: number; max: number } {
  let min = -1;
  let max = -1;
  for (let v = 0; v <= 255; v++) {
    if (cardFailure([v, v, v], tokens) === null) {
      if (min < 0) min = v;
      max = v;
    }
  }
  if (min < 0) throw new Error('glassBudget: no card luminance satisfies the constraints');
  return { min, max };
}

/**
 * The brightest neutral GROUND a card may sit on, given its fill alpha — the number
 * `components/ScreenBackground.tsx` has to respect.
 *
 * Inverts `painted = 255·alpha + ground·(1 − alpha)` at the top of the band. Neutral-grey is an
 * approximation of a chromatic wash, so the test that consumes this evaluates real colours point
 * by point via `cardFailure` and uses this only to report headroom.
 */
export function maxGroundLuminance(alpha: number, tokens: CardTokens): number {
  const { max } = cardLuminanceBand(tokens);
  return (max - 255 * alpha) / (1 - alpha);
}
