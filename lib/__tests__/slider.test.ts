/**
 * slider.test.ts — the finger-position ⇄ number mapping behind components/Slider.tsx.
 *
 * The gesture itself can't be exercised headlessly, so what is pinned here is everything that
 * ISN'T the gesture: clamping at both ends, landing exactly on steps, the float noise a 0.05
 * step accumulates, and the step-index the per-step haptic is fired off.
 */
import {
  clampToRange,
  decimalsForStep,
  ratioFromValue,
  snapToStep,
  stepIndex,
  valueFromRatio,
} from '@/lib/slider';

describe('clampToRange', () => {
  test('holds a value inside its range', () => {
    expect(clampToRange(5, 0, 10)).toBe(5);
    expect(clampToRange(-3, 0, 10)).toBe(0);
    expect(clampToRange(99, 0, 10)).toBe(10);
  });

  // A finger dragged off the end of the track keeps producing the end value, so an infinity
  // clamps like any other overshoot. Only NaN is meaningless — and a NaN reaching `width`
  // blanks the control, so it must not propagate.
  test('NaN falls back to the minimum; an infinity clamps like any overshoot', () => {
    expect(clampToRange(NaN, 0.4, 2.5)).toBe(0.4);
    expect(clampToRange(Infinity, 0.4, 2.5)).toBe(2.5);
    expect(clampToRange(-Infinity, 0.4, 2.5)).toBe(0.4);
  });

  test('a reversed range collapses to the minimum instead of throwing', () => {
    expect(clampToRange(5, 10, 0)).toBe(10);
  });
});

describe('decimalsForStep', () => {
  test.each([
    [1, 0],
    [0.5, 1],
    [0.05, 2],
    [0.02, 2],
    [0.25, 2],
    [0.001, 3],
  ])('a step of %p implies %i decimals', (step, expected) => {
    expect(decimalsForStep(step)).toBe(expected);
  });

  test('caps at 4 so a pathological step cannot drive toFixed off a cliff', () => {
    expect(decimalsForStep(0.000000001)).toBeLessThanOrEqual(4);
  });
});

describe('snapToStep', () => {
  test('lands exactly on a step', () => {
    expect(snapToStep(0.37, 0, 3, 0.05)).toBe(0.35);
    expect(snapToStep(0.38, 0, 3, 0.05)).toBe(0.4);
  });

  // The reason this function exists at all: the design lab was rounding by hand because
  // 0.05 steps accumulate into `1.0500000000000003` and that lands in the exported document.
  test('carries no float noise into the result', () => {
    for (let i = 0; i <= 60; i++) {
      const v = snapToStep(i * 0.05, 0, 3, 0.05);
      expect(String(v)).toMatch(/^\d+(\.\d{1,2})?$/);
    }
  });

  // Snapping is anchored at `min`. 0.7-1.6 by 0.02 has no step on a multiple of 0.02 from
  // zero that also equals 0.7, so an origin-anchored snap would make the minimum unreachable.
  test('the minimum and maximum are both reachable on an offset range', () => {
    expect(snapToStep(0.7, 0.7, 1.6, 0.02)).toBe(0.7);
    expect(snapToStep(1.6, 0.7, 1.6, 0.02)).toBe(1.6);
    expect(snapToStep(0.69, 0.7, 1.6, 0.02)).toBe(0.7);
    expect(snapToStep(99, 0.7, 1.6, 0.02)).toBe(1.6);
  });

  // 0-10 by 3 has its grid at 0,3,6,9 — the far end of the track is off-grid. It must still
  // be reachable, or the slider's right edge quietly produces 9 out of 10.
  test('the maximum stays reachable when the range is not a whole number of steps', () => {
    expect(snapToStep(10, 0, 10, 3)).toBe(10);
    expect(snapToStep(11, 0, 10, 3)).toBe(10);
    // …without swallowing the last real step: 9.4 is nearer 9 than 10.
    expect(snapToStep(9.4, 0, 10, 3)).toBe(9);
  });

  test('a step of 0 means no snapping, only clamping', () => {
    expect(snapToStep(0.3737, 0, 3, 0)).toBe(0.3737);
    expect(snapToStep(-1, 0, 3, 0)).toBe(0);
  });
});

describe('ratioFromValue / valueFromRatio', () => {
  test('the ends of the track are the ends of the range', () => {
    expect(ratioFromValue(0.4, 0.4, 2.5)).toBe(0);
    expect(ratioFromValue(2.5, 0.4, 2.5)).toBe(1);
    expect(valueFromRatio(0, 0.4, 2.5, 0.05)).toBe(0.4);
    expect(valueFromRatio(1, 0.4, 2.5, 0.05)).toBe(2.5);
  });

  test('a ratio outside 0-1 is clamped, not extrapolated', () => {
    expect(valueFromRatio(-0.5, 0, 10, 1)).toBe(0);
    expect(valueFromRatio(1.5, 0, 10, 1)).toBe(10);
  });

  test('a value outside the range still yields a ratio on the track', () => {
    expect(ratioFromValue(-99, 0, 10)).toBe(0);
    expect(ratioFromValue(99, 0, 10)).toBe(1);
  });

  test('round-trips every step of a real design-lab knob', () => {
    // borderCardWidth: 0-6 by 0.25.
    for (let v = 0; v <= 6.0001; v += 0.25) {
      const value = Number(v.toFixed(2));
      expect(valueFromRatio(ratioFromValue(value, 0, 6), 0, 6, 0.25)).toBe(value);
    }
  });

  test('a zero-width range reads as the start rather than dividing by zero', () => {
    expect(ratioFromValue(5, 5, 5)).toBe(0);
    expect(valueFromRatio(0.5, 5, 5, 1)).toBe(5);
  });
});

describe('stepIndex — what the per-step haptic counts', () => {
  test('counts steps from the minimum', () => {
    expect(stepIndex(0.4, 0.4, 2.5, 0.05)).toBe(0);
    expect(stepIndex(0.45, 0.4, 2.5, 0.05)).toBe(1);
    expect(stepIndex(2.5, 0.4, 2.5, 0.05)).toBe(42);
  });

  // A continuous slider must not buzz once per pixel — one index means one haptic, ever.
  test('an unstepped slider has a single step', () => {
    expect(stepIndex(0, 0, 10, 0)).toBe(0);
    expect(stepIndex(7.3, 0, 10, 0)).toBe(0);
  });

  test('is stable at the ends, so dragging past the edge fires nothing further', () => {
    expect(stepIndex(99, 0, 10, 1)).toBe(stepIndex(10, 0, 10, 1));
    expect(stepIndex(-99, 0, 10, 1)).toBe(stepIndex(0, 0, 10, 1));
  });
});
