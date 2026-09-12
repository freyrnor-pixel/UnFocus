/**
 * layoutGrid.ts — how to react to an `onLayout` value without building a loop.
 *
 * Two questions, both of which a component that measures itself and then animates toward what
 * it measured has to get right, and both of which were got wrong in `components/Collapsible.tsx`
 * in ways that reached a device:
 *
 *   1. **Is this change REAL, or is it the pixel grid rounding?** — `sameLayout`, below.
 *   2. **Is the target STILL MOVING?** — `resizeMode`, at the bottom.
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
 *   Imports → react-native (PixelRatio). ⚠️ **Nothing else, and `constants/motion` in
 *             particular is out** — it pulls in react-native-reanimated, which cannot load in
 *             the node test environment, and importing it here took the whole suite down. The
 *             resize WINDOW is passed in by the caller for that reason; same dependency-free
 *             rule lib/tourSpotlight.ts keeps, and for the same payoff.
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


/* ──────────────────────────────────────────────────────────────────────────────
 * Is the target still moving?
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Should a newly measured height be EASED toward, or TRACKED exactly?
 *
 * ⚠️ **Easing a height that is itself animating is a visible bug, and it shipped** (2026-09-12,
 * device report: *"wrong height and flickering"* on a card's first opens). Easing is right for a
 * DISCRETE change — a row added to or removed from an open card, which is what the 2026-08-14
 * pass added it for. It is wrong for a CONTINUOUS one: a nested `Collapsible` revealing inside
 * an open card makes its parent's `onLayout` fire every frame, and every one of those RESTARTS
 * the tween from wherever it had got to. A tween restarted every frame never gets past its own
 * first few frames.
 *
 * Measured in the web preview, an already-open card while its child revealed:
 *
 *   before   content 300 → 333 → 371 → 403 → 429 → 451 → 467 → 480 → 490 → 496 → 500 → 504
 *            clip    300   300   300   300   306   316   331   348   365   382   399  440 → 504
 *            max lag 103px for ~200ms, then a 63px snap when the measurements stopped
 *   after    clip    300   300   300   371   403   429   451   467   480   490   496   503  504
 *            max lag 33px on a first open, 3px on a second, and no snap at all
 *
 * Every pixel of that lag is content sliced off by the card's own bottom edge, and the snap
 * lands when everything else has stopped moving, which is what makes it read as a flicker.
 *
 * **You cannot smooth something that is already smooth; you can only lag it.** So the first
 * request eases (the discrete case is unchanged) and, if another arrives before `settlesAt`, the
 * target is moving and the clip tracks it exactly from then on.
 *
 * `settlesAt` is the caller's own `now + <the resize animation's duration>` — the window has to
 * BE that duration, because the question is precisely "would the last one have landed yet?".
 *
 * Pure, and separate from the component, for the reason `lib/commitOnce.ts` is: this repo has no
 * hook- or component-rendering library, so a rule left inline in JSX cannot be exercised by
 * anything. `lib/__tests__/layoutGrid.test.ts` runs it over real frame sequences.
 */
export function resizeMode(now: number, settlesAt: number): 'ease' | 'track' {
  return now < settlesAt ? 'track' : 'ease';
}
