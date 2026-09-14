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
import { pixelQuantum, resizeMode, sameLayout } from '@/lib/layoutGrid';

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
  // ⚠️ **`Math.fround` is the whole fidelity of this model, added 2026-09-14.** Yoga stores
  // computed layout as float32, so the number an `onLayout` hands JS is a float32 widened to a
  // double — confirmed against the real engine, where `Math.fround(h) === h` for every height it
  // returns. Without this the division below stays in float64 and the error against an exact
  // quantum is ~1e-15, which made the sweep pass at every density while the shipped predicate
  // was rejecting one quantum of genuine rounding at 2.625, 2.75, 3 and 3.5. A model that
  // reproduces the mechanism in the wrong PRECISION passes for the wrong reason — the same trap
  // CLAUDE.md A2 records for `glassMaterial`, one level down.
  return Math.fround((px(top + contentHeight) - px(top)) / density);
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

  /**
   * The slack is derived, not chosen, and TWO files depend on the derivation:
   * `lib/layoutGrid.ts` uses it, and `scripts/measure-yoga.mjs` mirrors the number because a
   * plain node script cannot import a module that pulls in react-native. A mirror that drifts is
   * a harness quietly measuring something else, so pin the arithmetic here — the one place both
   * can be checked against.
   *
   * Read `FLOAT_SLACK`'s block in `lib/layoutGrid.ts` before touching these numbers: shrinking
   * them re-arms the #700 loop, and there is no room to grow them into a real change.
   */
  it('allows a float32 ulp at the largest layout coordinate, and nothing near a real change', () => {
    const FLOAT32_EPSILON = 1.1920929e-7;
    const MAX_LAYOUT_COORD = 16384;
    const slack = MAX_LAYOUT_COORD * FLOAT32_EPSILON;

    // What scripts/measure-yoga.mjs hardcodes. Same product, written the same way.
    expect(16384 * 1.1920929e-7).toBeCloseTo(slack, 12);

    // The margin that makes it safe: the smallest quantum this app can meet is 1/4 (density 4),
    // and the slack has to stay far under it or it starts swallowing real changes.
    expect(slack).toBeLessThan(0.25 / 100);

    // And it has to be big enough for the error it exists for: float32 at a real card's depth.
    // A node 100dp down a screen carries ~6.2e-6; the old absolute 1e-6 did not cover that.
    expect(slack).toBeGreaterThan(6.2e-6);
  });

  it('still sees a real change through that noise', () => {
    atDensity(2.625, () => {
      const settled = roundedHeight(0, 137.37, 2.625);
      // One extra row of the smallest kind the app draws is far outside the quantum.
      expect(sameLayout(roundedHeight(0.4, 137.37 + 24, 2.625), settled)).toBe(false);
    });
  });
});

/**
 * resizeMode — ease a discrete height change, track a continuous one.
 *
 * Same discipline as the density sweep above: these run the rule over real frame sequences
 * rather than asserting that `Collapsible.tsx` contains the word `resizeMode`. The sequences are
 * the two the component actually meets, and telling them apart is the whole job.
 */
describe('resizeMode', () => {
  /**
   * The window is `Duration.card` at the call site, but that module imports Reanimated and
   * cannot load here — see lib/layoutGrid.ts's Imports note. The rule is window-agnostic, so the
   * sequences below use the same number literally and `collapseMotion.test.ts` pins that
   * `Collapsible.tsx` really passes the token.
   */
  const RESIZE_WINDOW = 220;

  /** Replay a series of `onLayout` timestamps through the rule the way the component does. */
  function replay(times: number[]): ('ease' | 'track')[] {
    let settlesAt = 0;
    return times.map((now) => {
      const mode = resizeMode(now, settlesAt);
      settlesAt = now + RESIZE_WINDOW;
      return mode;
    });
  }

  it('eases a lone change — a row added to an open card', () => {
    expect(replay([1000])).toEqual(['ease']);
  });

  it('eases every change when they are far apart', () => {
    // Three separate row edits, seconds apart. Each is discrete and each should be animated;
    // this is the 2026-08-14 behaviour and narrowing it must not have cost it.
    expect(replay([0, 3000, 7000])).toEqual(['ease', 'ease', 'ease']);
  });

  /**
   * The regression. A nested Collapsible revealing inside an open card fires `onLayout` on the
   * parent every frame for the length of the reveal. Easing each one restarts the tween, so the
   * clip crawls ~100px behind its own content and then snaps — the reported "wrong height and
   * flickering".
   */
  it('tracks a target that is still moving — a nested reveal at 60fps', () => {
    const frames = Array.from({ length: 14 }, (_, i) => i * 16.7);
    const modes = replay(frames);
    expect(modes[0]).toBe('ease');
    expect(modes.slice(1)).toEqual(Array(13).fill('track'));
  });

  it('keeps tracking for as long as the events keep coming', () => {
    // A slow reveal on a struggling frame budget: still inside the window, still moving.
    const frames = Array.from({ length: 20 }, (_, i) => i * (RESIZE_WINDOW - 20));
    expect(replay(frames).slice(1).every((m) => m === 'track')).toBe(true);
  });

  it('goes back to easing once the content has settled', () => {
    // A reveal, then a pause longer than the window, then one discrete edit.
    const reveal = [0, 16.7, 33.4, 50.1];
    const modes = replay([...reveal, 50.1 + RESIZE_WINDOW + 1]);
    expect(modes[modes.length - 1]).toBe('ease');
  });

  it('treats the exact window boundary as settled, not moving', () => {
    // `<` not `<=`: at exactly `settlesAt` the previous animation has finished, so there is
    // nothing to chase and the next change is discrete again.
    expect(resizeMode(RESIZE_WINDOW, RESIZE_WINDOW)).toBe('ease');
    expect(resizeMode(RESIZE_WINDOW - 1, RESIZE_WINDOW)).toBe('track');
  });
});
