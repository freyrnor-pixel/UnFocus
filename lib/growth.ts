/**
 * growth.ts — pure helpers for the ambient growth reward (2026-07-31).
 *
 * Replaces the one-day-old Bonsai/points system (lib/bonsai.ts, deleted). Same intent —
 * reward, not balance, and no punishment — but it shows up in the app's own backdrop
 * (components/ScreenBackground.tsx) instead of a card, and it shows the user NO NUMBERS at
 * all. Two channels, deliberately different in kind:
 *
 *   - **Intensity** [0, 1] — a positive tint that rises with the current streak and fades
 *     back toward 0. 0 is NEUTRAL, not failure: it is exactly the blue backdrop the app has
 *     always had, so a lapsed streak returns you to the normal app rather than to a
 *     visibly-worse one. This is the same floor-at-neutral shape as lib/goalStrength.ts.
 *   - **Level** 0…GROWTH_LEVELS.length-1 — how many branches have grown in around the
 *     screen border. Driven by the user's BEST streak ever (a high-water mark), so it
 *     never recedes. Branches that grew stay grown.
 *
 * A day counts as "active" if any habit was met OR any task was completed on it. Both, not
 * just habits — the maintainer's call (2026-07-31), so the streak reflects the whole app
 * rather than only the Habits tab.
 *
 * The streak does NOT break the moment a day starts. `daysSinceActive` drives a gradual
 * decay over GROWTH_DECAY_DAYS, so an untouched morning costs a sliver of tint, not the
 * whole streak — nothing here can produce a "you broke it" moment.
 *
 * Deliberately dependency-free (plain arrays in, numbers out — no store/DB/notification
 * access), same rule as lib/cardLayout.ts, so it stays trivially testable and can't grow a
 * side effect. The store-reading wrapper is lib/useGrowth.ts.
 *
 * Connections:
 *   Imports → lib/date (dateStr), lib/habitRecurrence (habitMetOn), store type imports
 *             (Task from store/useTaskStore, Habit/HabitLog from store/useHabitStore)
 *   Used by → lib/useGrowth.ts, lib/__tests__/growth.test.ts
 *   Data    → none (pure functions)
 */
import { dateStr } from '@/lib/date';
import { habitMetOn } from '@/lib/habitRecurrence';
import type { Task } from '@/store/useTaskStore';
import type { Habit, HabitLog } from '@/store/useHabitStore';

/** Streak length at which the tint reaches full strength. */
export const GROWTH_RAMP_DAYS = 21;

/** Idle days after which the tint has faded all the way back to neutral. */
export const GROWTH_DECAY_DAYS = 10;

/** Hard bound on how far back a streak scan walks — a streak longer than this is already
 *  past every level threshold, so counting further changes nothing on screen. */
export const GROWTH_SCAN_DAYS = 120;

/** Best-streak thresholds at which another group of border branches has grown in. The only
 *  numbers that set the growth pace — tune freely. */
export const GROWTH_LEVELS = [0, 3, 7, 14, 30, 60];

/** Did anything happen on this date — any habit met, or any task completed? */
export function isActiveOn(
  date: string,
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[]
): boolean {
  for (const t of tasks) {
    if (t.done && t.date === date) return true;
  }
  for (const h of habits) {
    if (habitMetOn(h, logs, date)) return true;
  }
  return false;
}

/** Shift a 'YYYY-MM-DD' date by -n days. Noon avoids any DST edge on the parse. */
function daysBefore(today: string, n: number): string {
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

/**
 * How many days ago (0 = today) the last active day was, scanning back at most
 * GROWTH_DECAY_DAYS — the tint is already fully faded past that, so there is nothing to
 * gain by looking further. null means "nothing within the window".
 */
export function daysSinceActive(
  today: string,
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[]
): number | null {
  for (let i = 0; i <= GROWTH_DECAY_DAYS; i++) {
    if (isActiveOn(daysBefore(today, i), tasks, habits, logs)) return i;
  }
  return null;
}

/**
 * Consecutive active days ending at the most recent active day (NOT necessarily today) —
 * so a streak stays whole through a morning that hasn't happened yet. Returns 0 when the
 * last active day is outside the decay window, since by then the tint is neutral anyway.
 */
export function currentStreak(
  today: string,
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[]
): number {
  const since = daysSinceActive(today, tasks, habits, logs);
  if (since == null) return 0;
  let streak = 0;
  for (let i = since; i < GROWTH_SCAN_DAYS; i++) {
    if (!isActiveOn(daysBefore(today, i), tasks, habits, logs)) break;
    streak++;
  }
  return streak;
}

/**
 * Positive tint strength in [0, 1]: how far the streak has climbed the ramp, reduced by how
 * long it's been since the last active day. Both factors floor at 0 — neutral — and neither
 * can push it below that.
 */
export function growthIntensity(streak: number, since: number | null): number {
  if (streak <= 0 || since == null) return 0;
  const ramp = Math.min(1, Math.max(0, streak / GROWTH_RAMP_DAYS));
  const decay = Math.min(1, Math.max(0, 1 - since / GROWTH_DECAY_DAYS));
  return ramp * decay;
}

/** Highest level whose threshold `bestStreak` has reached. Monotonic by construction — the
 *  caller feeds it a high-water mark, never the current streak. */
export function growthLevel(bestStreak: number): number {
  let level = 0;
  for (let i = 0; i < GROWTH_LEVELS.length; i++) {
    if (bestStreak >= GROWTH_LEVELS[i]) level = i;
  }
  return level;
}

export type GrowthState = {
  /** Consecutive active days ending at the most recent active day. */
  streak: number;
  /** Best streak ever reached, after folding in today's. Persist this back. */
  best: number;
  /** Border branches grown in, from `best` — never recedes. */
  level: number;
  /** Positive tint strength [0, 1]; 0 is the app's normal neutral backdrop. */
  intensity: number;
};

/** Everything lib/useGrowth.ts needs in one call. `storedBest` is the persisted high-water
 *  mark; the returned `best` folds today's streak into it. */
export function growthState(
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[],
  storedBest: number,
  today: string
): GrowthState {
  const since = daysSinceActive(today, tasks, habits, logs);
  const streak = currentStreak(today, tasks, habits, logs);
  const best = Math.max(storedBest, streak);
  return { streak, best, level: growthLevel(best), intensity: growthIntensity(streak, since) };
}
