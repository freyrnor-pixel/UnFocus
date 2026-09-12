/**
 * layoutGrid.test.ts — the pixel-grid dedupe, and the loop it is there to stop.
 *
 * ⚠️ **Read `CLAUDE.md`'s A2 note on constant predicates before changing this file.** The
 * cautionary tale there is `glassMaterial.test.ts`, where three source-text assertions were
 * updated to match a new string and passed while the expression they described had gone
 * constant — a regex can confirm code exists but never that it runs. So this file does not
 * assert that `Collapsible.tsx` contains the word `sameLayout`. It reconstructs the arithmetic
 * that produced the device bug and runs the dedupe over it, which is the only form of this test
 * that can fail for the right reason.
 */
import { PixelRatio } from 'react-native';
import { pixelQuantum, sameLayout } from '@/lib/layoutGrid';

/** Android densities that ship in volume. 2.625 and 2.75 are the fractional ones. */
const DENSITIES = [1, 1.5, 2, 2.625, 2.75, 3, 3.5];

function atDensity(density: number, run: () => void) {
  const spy = jest.spyOn(PixelRatio, 'get').mockReturnValue(density);
  try {
    run();
  } finally {
    spy.mockRestore();
  }
}

/**
 * What Android actually hands back: Yoga rounds a node's absolute edges to whole physical
 * pixels, so the dp height it reports is a function of WHERE the node sits, not only of what is
 * inside it. This is the noise generator the dedupe has to absorb.
 */
function roundedHeight(top: number, contentHeight: number, density: number) {
  const px = (v: number) => Math.round(v * density);
  return (px(top + contentHeight) - px(top)) / density;
}

describe('pixelQuantum', () => {
  it('is one physical pixel expressed in dp', () => {
    for (const d of DENSITIES) atDensity(d, () => expect(pixelQuantum()).toBeCloseTo(1 / d, 10));
  });

  it('falls back to 1dp rather than dividing by zero on a bogus density', () => {
    atDensity(0, () => expect(pixelQuantum()).toBe(1));
  });
});

describe('sameLayout', () => {
  it('treats an unchanged value as unchanged', () => {
    atDensity(2.75, () => expect(sameLayout(120.5, 120.5)).toBe(true));
  });

  it('admits a real content change — a row, a wrapped line', () => {
    atDensity(2.75, () => {
      expect(sameLayout(120, 148)).toBe(false);
      expect(sameLayout(120, 118)).toBe(false);
    });
  });

  it('is symmetric', () => {
    atDensity(2.625, () => expect(sameLayout(100, 100.4)).toBe(sameLayout(100.4, 100)));
  });

  /**
   * The regression. Unchanged content, dragged across the pixel grid the way an animating
   * ancestor drags it, must never once look like a change — at ANY density. Before this helper
   * existed the comparison was `===`, every one of these sub-pixel deltas read as a new height,
   * and `Collapsible.tsx`'s open-resize branch started a fresh `withTiming` toward each one.
   * The tween then moved the node again, which is the loop: no React render anywhere in it, so
   * the render counters saw a static tree, and no pixel grid in react-native-web, so `npm run
   * jitter` could not reproduce it either.
   */
  it.each(DENSITIES)('swallows pixel-grid noise from a drifting ancestor at density %s', (density) => {
    atDensity(density, () => {
      // Deliberately NOT a whole number of physical pixels at any of these densities: content
      // that lands exactly on the grid cannot produce rounding noise, and 137.5 does exactly
      // that at every integer density — which made this sweep pass at 1, 2 and 3 by measuring
      // nothing. That is also the real-world reason the same build sits still on one phone and
      // will not settle on the next.
      const CONTENT = 137.37;
      // A parent tweening its height slides this node through every sub-pixel offset there is.
      const heights = Array.from({ length: 200 }, (_, i) => roundedHeight(i * 0.017, CONTENT, density));
      const distinct = new Set(heights);
      // Sanity: the generator must actually generate noise, or this test proves nothing.
      expect(distinct.size).toBeGreaterThan(1);

      const settled = heights[0];
      for (const h of heights) expect(sameLayout(h, settled)).toBe(true);
    });
  });

  it('still sees a real change through that noise', () => {
    atDensity(2.625, () => {
      const settled = roundedHeight(0, 137.37, 2.625);
      // One extra row of the smallest kind the app draws is far outside the quantum.
      expect(sameLayout(roundedHeight(0.4, 137.37 + 24, 2.625), settled)).toBe(false);
    });
  });
});
