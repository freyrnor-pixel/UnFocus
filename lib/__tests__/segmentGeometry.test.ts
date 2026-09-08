/**
 * segmentGeometry.test.ts — the sliding pill lands on the label it is highlighting.
 *
 * **Why this exists as arithmetic rather than a pixel test.** The four visual harnesses in this
 * repo could not see this defect and still cannot: `measure-geometry.mjs`'s own note records
 * that the pill has no accessible name and `pointerEvents="none"`, so that audit "measured where
 * the SEGMENTS sit and never where the pill" — the control was checked for everything except the
 * one thing that was wrong. `visual` compares whole frames, and a 1–2px pill offset inside a
 * 24px-tall control does not clear `MAX_DIFF_PIXELS`. So the bug shipped, was seen on a device
 * before it was seen by any gate, and the guard that closes it has to be at the level the bug
 * lives at: the box model.
 *
 * The expectation is derived INDEPENDENTLY (`flexCellLeft`, from the flex layout) rather than
 * from `segW` itself. Asserting a function against its own expression is how
 * `glassMaterial.test.ts` passed over a predicate that was constantly false; see CLAUDE.md's A2.
 *
 * Rule 1 — the guard was made to fail first. Against the shipped formula
 * `segW = (trackW - 2·SEG_PAD)/n`, "the pill sits on its segment" fails at every index but 0,
 * e.g. n=3, trackW=328, border=1.5 → pill at 214.67 for a cell at 212.67, and 108.0 wide for a
 * 106.0 cell.
 */
import { segmentGeometry, flexCellLeft, SEG_PAD } from '@/lib/segmentGeometry';

/** The widths a segmented control actually gets: inside a card, inside a sheet, full-bleed. */
const WIDTHS = [220, 280, 327, 328, 360.5, 430];
/** Shipped border is 1.5; the design lab's `borderScale` reaches both ends of this. */
const BORDERS = [1, 1.5, 2, 3, 4.5];
const COUNTS = [2, 3, 4, 5];

describe('the segmented pill sits exactly on its segment', () => {
  it('matches the flex cell at every index, width, border and count', () => {
    const off: string[] = [];
    for (const w of WIDTHS) {
      for (const b of BORDERS) {
        for (const n of COUNTS) {
          const { segW } = segmentGeometry(w, 48, n, b);
          for (let i = 0; i < n; i++) {
            // What the component draws: `left: SEG_PAD` plus `translateX: i * segW`.
            const pillLeft = SEG_PAD + segW * i;
            const cellLeft = flexCellLeft(w, n, b, i);
            const cellW = (w - b * 2 - SEG_PAD * 2) / n;
            if (Math.abs(pillLeft - cellLeft) > 0.01) {
              off.push(`w=${w} b=${b} n=${n} i=${i}: pill at ${pillLeft.toFixed(2)}, cell at ${cellLeft.toFixed(2)}`);
            }
            if (Math.abs(segW - cellW) > 0.01) {
              off.push(`w=${w} b=${b} n=${n}: pill ${segW.toFixed(2)}px wide, cell ${cellW.toFixed(2)}px`);
            }
          }
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('the last pill ends inside the track, never overhanging it', () => {
    // The reported symptom, asserted directly: the right-hand pill hanging over its own border.
    // Right edge of the last pill vs. the track's inner (content) right edge, both measured from
    // the padding-box origin the pill is positioned in.
    const off: string[] = [];
    for (const w of WIDTHS) {
      for (const b of BORDERS) {
        for (const n of COUNTS) {
          const { segW } = segmentGeometry(w, 48, n, b);
          const pillRight = SEG_PAD + segW * n;
          const innerRight = w - b * 2 - SEG_PAD;
          if (pillRight > innerRight + 0.01) {
            off.push(`w=${w} b=${b} n=${n}: pill ends at ${pillRight.toFixed(2)}, track inner edge at ${innerRight.toFixed(2)}`);
          }
        }
      }
    }
    expect(off).toEqual([]);
  });

  it('is inert before the first onLayout, so nothing is drawn at a guessed position', () => {
    // `SegmentedTrack` renders the pill only while `segW > 0`; this is the other half of the
    // 2026-08-14 "first placement snaps" fix, which depended on an unmeasured track reporting 0.
    expect(segmentGeometry(0, 0, 3, 1.5)).toEqual({ segW: 0, pillH: 0 });
    expect(segmentGeometry(300, 48, 0, 1.5)).toEqual({ segW: 0, pillH: 0 });
  });

  it('leaves no negative height when the border is thicker than the track', () => {
    expect(segmentGeometry(300, 4, 3, 6).pillH).toBe(0);
  });
});
