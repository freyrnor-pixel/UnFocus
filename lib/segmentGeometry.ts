/**
 * segmentGeometry.ts — where a SegmentedControl's sliding pill actually goes.
 *
 * One function, extracted from `components/FormControls.tsx`'s `SegmentedTrack` on 2026-09-08
 * so the arithmetic can be asserted instead of eyeballed. It was wrong, and it was wrong in the
 * way that layout maths usually is: by one term nobody thinks about.
 *
 * **The box model, which is the whole bug.** `onLayout` reports the BORDER box — width includes
 * the track's own `borderWidth` on both sides. The segments are ordinary `flex: 1` children, so
 * they divide the CONTENT box, which is `2 × border + 2 × padding` narrower. The pill is
 * `position: absolute`, and in Yoga an absolute child's `left` is measured from the PADDING box
 * — i.e. inside the border but before the padding — so `left: SEG_PAD` lands exactly on the
 * first segment. Only the WIDTH was ever wrong:
 *
 *     old:  segW = (trackW - 2·pad) / n            ← border still in it
 *     new:  segW = (trackW - 2·border - 2·pad) / n
 *
 * Each pill came out `2·border/n` too wide, and since the pill is placed at `i · segW`, pill *i*
 * also sat `i · 2·border/n` to the RIGHT of its label. At the shipped 1.5px border and n = 3
 * that is 1px of width and 2px of drift on the last segment — small, and visible: reported from
 * a device as "tab centering", on Settings' `Av/System/På` and `Liten/Standard/Stor` rows, where
 * the right-hand pill overhangs its own track and the middle label sits off-centre in its pill.
 * The design lab's `borderScale` multiplies the error, so at 3× it is 6px.
 *
 * ⚠️ **`components/TabSlider.tsx` does not share this bug and must not be "fixed" to match.**
 * It measures each segment's own `onLayout` rect rather than computing one, which is immune to
 * the box model by construction — see its header. This function is for the equal-width
 * form-tier control only, where every segment is `(content ÷ n)` by definition and measuring
 * each one would be n listeners to learn something arithmetic already knows.
 */

/** The padding on `styles.segmentWrap`, and the pill's inset from the track's inner edge. */
export const SEG_PAD = 4;

export type SegmentGeometry = {
  /** One segment's width — the pill's width, and its per-index step. */
  segW: number;
  /** The pill's height: the content box's height. */
  pillH: number;
};

/**
 * @param trackW  the track's `onLayout` width — a BORDER-box measurement
 * @param trackH  the track's `onLayout` height — likewise
 * @param n       number of segments
 * @param border  the track's rendered `borderWidth` (the design lab scales it)
 */
export function segmentGeometry(trackW: number, trackH: number, n: number, border: number): SegmentGeometry {
  if (!(trackW > 0) || n <= 0) return { segW: 0, pillH: 0 };
  const inner = trackW - border * 2 - SEG_PAD * 2;
  return {
    segW: Math.max(0, inner / n),
    pillH: Math.max(0, trackH - border * 2 - SEG_PAD * 2),
  };
}

/**
 * Where segment `index`'s own flex cell starts, in the pill's coordinate space.
 *
 * Only the tests use this: it is the INDEPENDENT expectation the pill is checked against, so it
 * is derived from the flex layout (content-box origin, equal shares) rather than from `segW`.
 * A guard that computes its expectation with the same expression it is checking proves nothing
 * — this repo has shipped that mistake before (see `glassMaterial.test.ts`'s predicate note).
 */
export function flexCellLeft(trackW: number, n: number, border: number, index: number): number {
  const inner = trackW - border * 2 - SEG_PAD * 2;
  return SEG_PAD + (inner / n) * index;
}
