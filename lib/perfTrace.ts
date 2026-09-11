/**
 * perfTrace.ts — dev-only render accounting for the scroll/swipe performance work.
 *
 * Exists because the two previous attempts at this app's lag (see app/(tabs)/_layout.tsx's
 * `lazy` edit notes — flipped and reverted twice) were both argued from a boot-time node
 * count, which is what a headless harness can measure, and both were wrong about what the
 * app FEELS like. Neither could answer the actual question: while a finger is on the glass,
 * WHICH tree is re-rendering? This answers that, on a device, with the real data.
 *
 * ⚠️ **Every export here compiles to a no-op in a release build.** `__DEV__` is a literal the
 * Metro minifier folds, so the `if (!__DEV__) return` branches let the whole body drop out.
 * Nothing in this file may allocate, subscribe, or measure in the APK the user installs —
 * a perf tool that costs frames is the joke that writes itself.
 *
 * Connections:
 *   Imports → react (useRef/useEffect only — deliberately no store, no RN, no Reanimated,
 *             so importing this file can never pull a subsystem into a screen's graph)
 *   Used by → nothing at rest, by design. This is an instrument you reach for: drop a
 *             `useRenderCount('Name')` into whichever component is under suspicion, take the
 *             measurement, then take it back out. A permanent call site would be a permanent
 *             (if cheap) cost in every dev build for no standing benefit.
 *   Data    → none (in-memory counters, reset on reload)
 *
 * Edit notes:
 *   - **Read the counter as a RATE, not a total.** A screen that renders 400 times over a
 *     minute of idling is broken; one that renders 40 times during a scroll may be fine. The
 *     `sinceLast` figure is there so a single scroll gesture can be isolated.
 *   - Do NOT add an on-screen overlay that re-renders itself to display these numbers — it
 *     would then be the heaviest thing on the screen and would perturb the measurement.
 *     `dumpRenderCounts()` prints on demand instead; call it from a debug control.
 */

/** Total renders per label since load, and the total as of the last dump. */
const counts = new Map<string, number>();
const lastDump = new Map<string, number>();

/**
 * Counts a render of `label`. No-op in release.
 *
 * Intentionally a plain module-level Map write rather than component state: setting state to
 * track renders would cause renders. This is a side effect during render, which React
 * tolerates here only because the value is never read during render and never affects output.
 */
export function useRenderCount(label: string): void {
  if (!__DEV__) return;
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

/**
 * Prints every label's total and its delta since the previous dump, busiest first.
 * Call once before a gesture and once after to attribute renders to that gesture.
 */
export function dumpRenderCounts(tag = ''): void {
  if (!__DEV__) return;
  const rows = [...counts.entries()]
    .map(([label, total]) => ({ label, total, sinceLast: total - (lastDump.get(label) ?? 0) }))
    .sort((a, b) => b.sinceLast - a.sinceLast);
  for (const [label, total] of counts) lastDump.set(label, total);
  console.log(`[perfTrace] ${tag}`, rows.filter((r) => r.sinceLast > 0));
}

/** Clears all counters — call at the start of a measurement run. */
export function resetRenderCounts(): void {
  if (!__DEV__) return;
  counts.clear();
  lastDump.clear();
}

/* ──────────────────────────────────────────────────────────────────────────────
 * The release-build half
 *
 * ⚠️ **Everything above is `__DEV__`-only, and that is exactly why it could not answer the
 * question it was built for.** The header's promise — "nothing in this file may allocate,
 * subscribe, or measure in the APK the user installs" — is right about cost and wrong about
 * reach: the bugs that survive to a device report are, by selection, the ones no harness and
 * no dev build reproduce. On 2026-09-10 a card on Home would not stop re-laying itself out on
 * a release install while `visual` (both themes), `geometry`, `wraps` and `jitter` were all
 * clean, four fixes had missed, and the one instrument that could have said "this tree renders
 * 900 times a second" was compiled out of the only build that showed the bug.
 *
 * So there is a second, tiny counter that DOES run in release. It is one `Map` get/set per
 * render of an explicitly instrumented component: no allocation, no subscription, no timer, no
 * React state, and nothing reads it unless a person opens Settings with Debug mode on. That is
 * a real cost and it is a rounding error next to a re-render storm you cannot see.
 *
 * Instrument deliberately and temporarily, the same way as `useRenderCount`: add a call, take
 * the measurement, take it back out. A call site left behind is not dangerous, it is just
 * untidy.
 * ────────────────────────────────────────────────────────────────────────────── */

/** Release-safe render tally, kept apart from the dev counters so neither can skew the other. */
const liveCounts = new Map<string, number>();
/** When counting began, so a caller can turn a total into a RATE — see `renderCountsSnapshot`. */
let liveSince = Date.now();

/**
 * Counts a render of `label` in EVERY build, release included.
 *
 * A side effect during render, like `useRenderCount` and for the same reason: tracking renders
 * with state would cause renders. The value is never read during render and never affects
 * output, so a double-invoked render in StrictMode over-counts and nothing else breaks.
 */
export function countRender(label: string): void {
  liveCounts.set(label, (liveCounts.get(label) ?? 0) + 1);
}

/**
 * Every instrumented label as `name: total (rate/s)`, busiest first, plus the window it covers.
 *
 * **Read it as a rate.** A card that renders a few dozen times while you use it is ordinary; the
 * same card at hundreds per second is the thing being hunted. The rate is what makes a single
 * number meaningful without asking anyone to time it themselves.
 */
export function renderCountsSnapshot(): string {
  const secs = Math.max(1, Math.round((Date.now() - liveSince) / 1000));
  const rows = [...liveCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return 'no counters';
  return `${secs}s — ` + rows.map(([label, n]) => `${label}: ${n} (${(n / secs).toFixed(1)}/s)`).join(' · ');
}

/** Clears the release counters and restarts the window, so a fresh measurement can be timed. */
export function resetLiveRenderCounts(): void {
  liveCounts.clear();
  liveSince = Date.now();
}

/**
 * Counts a native LAYOUT pass of `label`. Same counter map as `countRender`, so one read-out
 * shows both — prefix layout labels (`L:strip`) to keep them apart at a glance.
 *
 * ⚠️ **This is the half that can see what `countRender` cannot.** A React render and a native
 * layout are different events, and on 2026-09-10 a device separated them decisively: Home and
 * the Energy card each rendered 5 times in 45 seconds — 0.1/s, a static tree — while the card
 * visibly would not settle. Whatever moves is below React, so counting renders can only ever
 * say "not here". `onLayout` fires on the native pass itself, with no re-render required, which
 * makes it the only instrument in this codebase that can watch a layout loop from inside the
 * app.
 *
 * Attach as `onLayout={() => countLayout('L:name')}`. A handler is not free — it marshals a
 * layout event per pass — so instrument a handful of suspects, take the reading, take it out.
 */
export function countLayout(label: string): void {
  liveCounts.set(label, (liveCounts.get(label) ?? 0) + 1);
}
