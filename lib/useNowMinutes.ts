/**
 * useNowMinutes.ts — "what time is it, live" as minutes since midnight.
 *
 * Re-renders the caller once a minute so anything pinned to the current clock time
 * drifts along on its own: the Plans day-view's now-line, and the Health tab's medicine
 * card (which tray is due, when an as-needed dose becomes allowed again).
 *
 * Extracted from components/PlanTaskCard.tsx (2026-07-27) when the medicine card needed
 * the same tick — one shared interval-backed hook instead of two copies drifting apart.
 *
 * Connections:
 *   Imports → react, react-native (AppState), lib/date (localMinutesOf)
 *   Used by → components/PlanTaskCard.tsx (day-grid now-line),
 *             components/MedicineTrayCard.tsx (current/next tray, as-needed guard),
 *             app/plans.tsx + app/(tabs)/index.tsx (the day log's cutoff, and their
 *             own render-scope `today`), app/habits.tsx + app/(tabs)/health.tsx
 *             (2026-08-13 — subscribed for the DATE, not the minute: see below),
 *             lib/__tests__/useNowMinutes.test.ts, lib/__tests__/todayFreshness.test.ts
 *   Data    → none — reads the system clock only
 *
 * Edit notes:
 *   - 60s cadence is deliberate: everything reading this is minute-granular, so a
 *     shorter interval would only add re-renders. Nothing here needs seconds.
 *   - **The tick is aligned to the wall clock's minute boundary, and that is load-bearing
 *     (2026-08-13).** It used to be a bare `setInterval(…, 60000)` started at mount, so the
 *     tick landed at an arbitrary offset into each minute and this hook returned a value up
 *     to 59 seconds stale — i.e. a whole minute BEHIND the real clock minute for most of
 *     every minute. That is not cosmetic: `lib/dayLog.ts` cuts the day log at this value and
 *     a completion is stamped `done_at` at the current minute, so ticking a task at 12:01:05
 *     while this still said 12:00 dropped it from the log — and because the day log also
 *     suppresses the timeline's done zone, the task vanished from the card entirely until
 *     the next tick. It is the same failure the inclusive-cutoff regression test in
 *     lib/__tests__/dayLog.test.ts pins from the other end: that fixed `<` vs `<=` at the
 *     same minute, this fixes being at the wrong minute in the first place. Both are needed.
 *     Keep `msUntilNextMinute`'s small overshoot — a timer that fires a hair EARLY would read
 *     the minute it was trying to leave, and then sit on that stale value for a full minute.
 *   - **The chain re-arms from the clock on every tick, and re-reads on foreground.** A
 *     self-correcting `setTimeout` chain (not `setInterval`) is what keeps it on the boundary
 *     when a tick is delivered late, and phones suspend timers while backgrounded — so an app
 *     resumed after an hour would otherwise show an hour-old "now" until its next tick, which
 *     is the same bug at a worse scale. AppState covers that; `setNow` with an unchanged value
 *     is a no-op re-render, so the extra reads cost nothing.
 *   - **Two callers subscribe and ignore the value** (`useNowMinutes()` with no assignment,
 *     added 2026-08-13): the Habits and Health tabs want the RE-RENDER, because each derives
 *     `const today = todayStr()` at render scope and nothing else re-derives it — a mounted
 *     screen kept its pre-midnight date indefinitely, and on Habits that date is what
 *     `increment`/`decrement`/`markRestDay` WRITE. A bare call looks like a mistake, so don't
 *     "clean it up"; `lib/__tests__/todayFreshness.test.ts` fails if either one loses it. The
 *     minute cadence is finer than a date needs, but it is the tick the app already has, and
 *     one shared interval beats a second timer that fires once a day.
 *   - Returns a plain number (not a Date) so consumers compare against the same
 *     minutes-since-midnight scale lib/dayGrid.ts and lib/medicineSchedule.ts use.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localMinutesOf } from '@/lib/date';

const MS_PER_MINUTE = 60000;

/**
 * A few ms past the boundary rather than exactly on it. Timers are allowed to fire a hair
 * early, and landing at 11:59.998 would read the minute we are trying to leave — then hold
 * that stale value for the whole next minute, which is the bug this alignment exists to fix.
 */
const BOUNDARY_OVERSHOOT_MS = 200;

const currentMinutes = () => localMinutesOf(new Date());

/**
 * Milliseconds from `now` until just after the next wall-clock minute boundary.
 *
 * Pure and exported for lib/__tests__/useNowMinutes.test.ts — the alignment is the whole
 * point of this module and a test that drives real timers could only prove it slowly.
 */
export function msUntilNextMinute(now: Date): number {
  const intoMinute = now.getSeconds() * 1000 + now.getMilliseconds();
  return MS_PER_MINUTE - intoMinute + BOUNDARY_OVERSHOOT_MS;
}

export function useNowMinutes(): number {
  const [now, setNow] = useState(currentMinutes);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const arm = () => {
      timer = setTimeout(() => {
        setNow(currentMinutes());
        arm();
      }, msUntilNextMinute(new Date()));
    };
    arm();

    // A suspended timer is the same staleness, just larger — re-read on the way back in and
    // re-align, rather than waiting out whatever was left of the pre-suspend delay.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(currentMinutes());
      clearTimeout(timer);
      arm();
    });

    return () => {
      clearTimeout(timer);
      // Optional on purpose: react-native-web's AppState returns nothing at all when the
      // document has no visibility API (its `isAvailable` false branch), and the types don't
      // say so. Native always hands back a subscription.
      sub?.remove();
    };
  }, []);

  return now;
}

export default useNowMinutes;
