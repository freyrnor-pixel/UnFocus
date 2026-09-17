/**
 * deferredBoot.ts — run cold-start's deferred work as separate short tasks, not one long one.
 *
 * **The report this answers, and the redirect that found it.** Eight rounds into the swipe-lag
 * hunt the symptom had settled into *"Går seg til, men lagger de første gangene, spesielt til og
 * fra hjem og shop."* Three mechanisms had been excluded by measurement (page attach #719,
 * mount/render #721, JS work at rest #721) and one confirmed and fixed (#722). The maintainer then
 * said the thing that pointed here: ***"Tror ikke det nødvendigvis er hva som lastes inn, men når
 * og hvordan."*** Not *what* loads — *when and how*.
 *
 * **What was wrong with "when and how".** `app/_layout.tsx`'s cold start is two tiers. Tier A is
 * synchronous `getAllSync` scans, finished before the tabs mount, and render is gated on
 * `loaded` — so it cannot touch a swipe and is not this. Tier B was a **single
 * `InteractionManager.runAfterInteractions` callback** holding nine things: four SQLite store
 * loads, a per-task notification re-arm, three native notification-category registrations, and
 * `syncWidgetsAndOverview()` — whose own comment records that `buildWidgetSnapshot()` *"walks
 * every store, localises strings, and writes the widget_snapshot row — all synchronously before
 * the first await"*. Nine things, one task, one frame.
 *
 * Two properties of that made it land exactly where it hurt:
 *
 *   · **`runAfterInteractions` waits for ANIMATIONS, not for the user.** An `Animated` animation
 *     holds an interaction handle unless it opts out, so the block is queued behind
 *     `LaunchReveal`'s 800ms launch animation and behind the tabs layout's hero cross-fade, which
 *     fires on every tab change. A native ViewPager2 swipe, by contrast, creates **no** JS
 *     interaction handle at all — so `InteractionManager` does not wait for a swipe. It fires
 *     *during* one, in the gap between the animations it does wait for.
 *   · **It runs once.** Which is exactly why the lag "warms up": after that one block there is
 *     nothing left to land, and every later swipe is clean.
 *
 * Measured on the web preview, in the window the earlier idle probe missed (that one looked ~8s
 * out, by which time this had long finished): in the first second after the tabs appear there is
 * **156ms of long-task time and 133ms of dropped frames, then nothing at all for seven seconds** —
 * as two distinct spikes, 91ms at +45ms (the tab mount) and **65ms at +151ms**, the second being
 * this block. That is on an EMPTY profile, where the receipts, tombstones and peers it loads are
 * all empty and the widget snapshot walks nothing. On a real one it scales with the data.
 *
 * **What this module does.** `runStaggered` takes the same work as a list and gives each item its
 * own frame, so nine short tasks replace one long one. Nothing is dropped and nothing is
 * reordered — the order is still the order the caller writes, which matters because
 * `syncWidgetsAndOverview` must see the stores the loads above it filled.
 *
 * It also closes a real hole that had nothing to do with performance: the old block had **no
 * try/catch**, so a throw in (say) `usePeersStore.load()` silently skipped everything after it —
 * the notification categories and the widget refresh included. Each step is guarded here, so one
 * failure costs one step.
 *
 * ⚠️ **Frames, not timers.** A `setTimeout` chain would be an arbitrary number racing a variable
 * frame rate; `requestAnimationFrame` yields exactly once per frame, which is the unit "does this
 * block a swipe" is measured in. On a device with no frames being produced (app backgrounded) rAF
 * simply does not fire, which is the correct behaviour for deferred boot work.
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free, like `constants/`)
 *   Used by → app/_layout.tsx (cold-start Tier B)
 *   Data    → none directly; the steps it runs touch SQLite and the notification module
 */

/** One unit of deferred boot work. Sync or async — an async one is started, not awaited. */
export type BootStep = () => void | Promise<unknown>;

export type StaggerHandle = {
  /** Stop before the next step. Steps already run stay run. */
  cancel: () => void;
};

/**
 * Run `steps` in order, one per animation frame, each guarded.
 *
 * Returns a handle whose `cancel()` stops the chain — call it from an effect's cleanup so a
 * remount does not leave two chains walking the same list.
 *
 * `onStep` exists for tests and for `__DEV__` timing; it is called with the index just run.
 */
export function runStaggered(steps: readonly BootStep[], onStep?: (index: number) => void): StaggerHandle {
  let cancelled = false;
  let raf = 0;
  let i = 0;

  const pump = () => {
    if (cancelled || i >= steps.length) return;
    const step = steps[i];
    const ran = i;
    i += 1;
    try {
      // A returned promise is deliberately not awaited: these are fire-and-forget refreshes, and
      // awaiting would chain the frames to network/disk latency instead of to frames.
      void step();
    } catch {
      // One failing step costs one step. The old single-block version lost every step after a
      // throw, including the widget refresh — see this file's header.
    }
    onStep?.(ran);
    if (!cancelled && i < steps.length) raf = requestAnimationFrame(pump);
  };

  raf = requestAnimationFrame(pump);

  return {
    cancel: () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
