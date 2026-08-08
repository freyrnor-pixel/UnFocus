/**
 * slider.ts — the pure maths behind components/Slider.tsx.
 *
 * Split out of the component for the same reason lib/reorder.ts is split out of
 * components/DraggableTaskRow.tsx: the interesting part of a drag control is the mapping
 * between a finger position and a number, and that mapping is testable headlessly while the
 * gesture is not. Every function here is a pure number-in/number-out with no React, no
 * Reanimated and no store.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/Slider.tsx, lib/__tests__/slider.test.ts
 *   Data    → none (pure functions)
 *
 * Edit notes:
 *   - **Everything clamps; nothing rejects.** A finger that leaves the track at either end
 *     must keep producing the end value, not NaN and not "no change" — the same
 *     clamp-don't-validate rule lib/designLab.ts's numeric knobs follow, and for the same
 *     reason (a control that goes dead at its own ends feels broken).
 *   - **Snapping is anchored at `min`, not at zero.** A 0.7→1.6 range stepped by 0.02 has no
 *     step landing on a round number, so snapping to multiples of `step` would make the
 *     minimum unreachable.
 *   - `snapToStep` rounds the result to the step's own decimal places. Without it a 0.05 step
 *     accumulates float noise and the exported design-lab document reads
 *     `1.0500000000000003` — the same bug app/design-lab/tokens.tsx already works around by hand.
 */

/**
 * `n` held inside [min, max]. A reversed range (max < min) collapses to `min`.
 *
 * Only NaN falls back to `min` — ±Infinity is clamped like any other out-of-range number,
 * because "dragged past the end" is exactly what it means here and the end value is the
 * honest answer.
 */
export function clampToRange(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * How many decimals a step implies — `0.05` → 2, `1` → 0.
 *
 * Capped at 4: beyond that the noise being cleaned up is smaller than anything a slider can
 * express, and `toFixed` starts costing more than it fixes.
 */
export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  const text = String(step);
  const dot = text.indexOf('.');
  if (dot < 0) return 0;
  return Math.min(4, text.length - dot - 1);
}

/**
 * `n` snapped to the nearest step measured FROM `min`, then clamped and de-noised.
 *
 * A `step` of 0 (or a non-finite one) means "no snapping" — the value is only clamped.
 *
 * **`max` is always a valid stop, even when it is not on the grid.** Every design-lab knob
 * happens to span a whole number of steps today, but a range that doesn't (0–10 by 3) would
 * otherwise have a right-hand end the finger cannot reach — a slider whose far edge produces
 * 9 out of 10 reads as broken, so the two candidates are compared and the nearer one wins.
 */
export function snapToStep(n: number, min: number, max: number, step: number): number {
  const clamped = clampToRange(n, min, max);
  if (!Number.isFinite(step) || step <= 0) return clamped;
  const onGrid = clampToRange(min + Math.round((clamped - min) / step) * step, min, max);
  const nearest = Math.abs(max - clamped) < Math.abs(onGrid - clamped) ? max : onGrid;
  return Number(nearest.toFixed(decimalsForStep(step)));
}

/** Where `value` sits along the track, 0 (min) to 1 (max). A zero-width range reads as 0. */
export function ratioFromValue(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clampToRange((clampToRange(value, min, max) - min) / (max - min), 0, 1);
}

/** The value at `ratio` along the track, snapped to `step`. */
export function valueFromRatio(ratio: number, min: number, max: number, step: number): number {
  const r = clampToRange(ratio, 0, 1);
  return snapToStep(min + r * (max - min), min, max, step);
}

/**
 * Which step `value` is on, counted from `min`.
 *
 * The slider fires one `selection()` haptic per step CROSSED, not one per pixel moved, so it
 * compares this index between updates. An unstepped slider has one continuous "step", which
 * is why a `step` of 0 always answers 0 — a haptic per pixel would buzz continuously.
 */
export function stepIndex(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  return Math.round((clampToRange(value, min, max) - min) / step);
}
