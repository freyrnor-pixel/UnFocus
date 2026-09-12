/**
 * layoutGrid.ts — is a change in a measured layout REAL, or is it the pixel grid rounding?
 *
 * **Why this exists.** Android lays out on a physical-pixel grid. Yoga is given the display's
 * density as its point-scale factor, so every node's edges are rounded to whole device pixels
 * before the dp value comes back to JS — which means **a node's reported HEIGHT depends on its
 * absolute POSITION**, not only on its content. Round the top edge one way and the bottom edge
 * the other and the same unchanged content measures `1 / PixelRatio.get()` dp taller than it did
 * a frame ago. On a density-2.625 or -2.75 phone that is ~0.38 or ~0.36 dp of pure noise, on
 * every layout pass that moves the node by a fraction of a pixel.
 *
 * That noise is harmless until something FEEDS IT BACK. A component that measures itself with
 * `onLayout` and then animates a height toward what it measured has built a loop: the animation
 * moves the node, the move re-rounds the measurement, the new measurement restarts the
 * animation. It never converges, and it is invisible to almost every instrument we have —
 * `lib/perfTrace.ts`'s render counters read a static tree (the whole cycle lives on the UI
 * thread and in `onLayout`, neither of which is a React render), and `npm run jitter` runs
 * react-native-web, which has no pixel grid to round to and therefore cannot produce the noise
 * at all. See that script's "clean here narrows the cause to the native side" caveat: this is
 * what was on the native side.
 *
 * It is also why the same build flickers on one phone and not another. The rounding error is a
 * function of the device's density (and of where a given card happens to land on the grid), so
 * an integer-density display can sit still while a fractional one oscillates forever.
 *
 * **The rule: never compare two measured layout values with `===`.** Ask `sameLayout(a, b)`
 * instead. Exact equality on a float that native rounding perturbs means the dedupe that was
 * supposed to stop a loop silently stops stopping it.
 *
 * Connections:
 *   Imports → react-native (PixelRatio)
 *   Used by → components/Collapsible.tsx (the measured-height clip — the loop this was written
 *             for)
 *   Data    → none (pure, apart from reading the display density)
 *
 * Edit notes:
 *   - **The threshold is the grid quantum, not a taste value.** One physical pixel in dp is the
 *     largest error the rounding can introduce, so anything at or under it is indistinguishable
 *     from noise and anything over it is a real change. Don't raise it to "be safe": a genuine
 *     content change (a row appearing, a line of text wrapping) is many dp, and a bigger
 *     threshold only starts swallowing real ones.
 *   - `PixelRatio.get()` is read per call rather than captured at module load. It is a cheap
 *     constant lookup, and reading it lazily keeps this module honest under a display change
 *     and trivially mockable in tests.
 *   - Pure and dependency-light on purpose, so `lib/__tests__/layoutGrid.test.ts` can pin the
 *     arithmetic without a renderer.
 *   - ⚠️ **Reach for this only where a measurement FEEDS BACK into layout, and pair it with a
 *     commit** (2026-09-12, measured). It was applied to `TabSlider` and `FormControls` in the
 *     first cut of this pass and taken back out: both measure a track to place an absolutely
 *     positioned pill, and an absolute pill cannot change the track it was measured from, so
 *     there is no loop there to break — the guard bought nothing and risked a pill left a dp
 *     stale. Worse, a dedupe that only SKIPS makes the resting layout depend on which
 *     measurement happened to arrive first: `npm run visual` went from 26/26 unchanged on three
 *     consecutive runs to flagging a different screen on each. Where the guard belongs, it must
 *     suppress the ANIMATION and still commit the value — see `Collapsible.tsx`'s `onLayout`.
 */
import { PixelRatio } from 'react-native';

/**
 * One physical pixel expressed in dp — the widest gap the pixel-grid rounding can open between
 * two measurements of the same unchanged content.
 */
export function pixelQuantum(): number {
  const density = PixelRatio.get();
  return density > 0 ? 1 / density : 1;
}

/**
 * Slack for binary floating point, and nothing else.
 *
 * A gap of exactly one quantum IS the rounding, so the comparison below has to include it — but
 * both sides arrive as `n / density` divisions, and at density 3.5 the two rounded heights of
 * unchanged content came out `0.2857142857142918` apart against a quantum of
 * `0.2857142857142857`. Six parts in 10^15 too wide, and a bare `<=` called it a real change:
 * exactly the noise this module exists to absorb, let through by the representation rather than
 * by the arithmetic. Caught by the density sweep in lib/__tests__/layoutGrid.test.ts, which is
 * why that sweep runs every density rather than one representative one.
 *
 * It is a float-error allowance, NOT a tuning knob — a millionth of a dp is far below anything
 * a layout can express, so widening it cannot buy anything and would only start hiding real
 * changes.
 */
const FLOAT_SLACK = 1e-6;

/**
 * Are these two measured layout values the same thing, allowing for pixel-grid rounding?
 *
 * Use this anywhere an `onLayout` value is compared against a previously stored one to decide
 * whether to do any work. `<=` rather than `<` because a difference of exactly one quantum IS
 * the rounding, not a change.
 */
export function sameLayout(a: number, b: number): boolean {
  return Math.abs(a - b) <= pixelQuantum() + FLOAT_SLACK;
}
