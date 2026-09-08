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
