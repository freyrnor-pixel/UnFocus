/**
 * habitRecurrence.ts — pure habit occurrence + progress helpers.
 *
 * Extracted (2026-07-22) so the "is this habit due on date X" and "has it been met"
 * logic exists in exactly one place, instead of duplicated across
 * app/(tabs)/habits.tsx, lib/widgets/sync.ts, and lib/energy.ts. Also the home of
 * `weekly-flexible` support — a recurrence where the habit is due EVERY day of the
 * week (any day counts) and its goal (`dailyGoal`, reused as a per-week target in
 * this mode) is met once the week's cumulative logged count reaches it, rather than
 * needing specific weekdays picked in advance. Used for goals like "go outside with
 * the kids at least 3x this week" where the days genuinely vary.
 *
 * **`recurrenceInterval` — "every N days"/"every N weeks" (2026-08-11).** A MULTIPLIER
 * on `daily`/`weekly`, not a new recurrence kind — `monthly`/`one-time`/`weekly-flexible`
 * ignore it entirely. The phase anchor (which day/week is "week 0") is DERIVED from
 * `habit.createdAt` here, on every call, and is never stored — same discipline as
 * lib/taskRotation.ts's rotation anchor and `episode_state`: two devices computing the
 * same thing from the same input can't disagree the way a stored, separately-updated
 * flag could. `createdAt` is SQLite's `datetime('now')`, i.e. a UTC 'YYYY-MM-DD HH:MM:SS'
 * string (a handful of older rows are a full ISO string instead) — only its first 10
 * characters (the date part) are read, and the UTC/local distinction doesn't matter
 * because it is only ever compared against another plain date string, never a clock
 * time. A missing/unparseable `createdAt` fails OPEN (treated as interval 1, i.e. the
 * habit occurs) — this function's job is deciding what shows up today, and hiding a
 * habit because of a bad timestamp is worse than showing it on the "wrong" phase.
 *
 * Connections:
 *   Imports → lib/date (getWeekDates), store/useHabitStore (Habit/HabitLog types)
 *   Used by → lib/energy.ts, app/(tabs)/habits.tsx, lib/widgets/sync.ts
 *   Data    → none (pure functions)
 */
import { getWeekDates } from '@/lib/date';
import type { Habit, HabitLog } from '@/store/useHabitStore';

function logCount(habitId: string, logs: HabitLog[], date: string): number {
  const log = logs.find((l) => l.habitId === habitId && l.logDate === date);
  return log?.count ?? 0;
}

/** The `YYYY-MM-DD` date part of `habit.createdAt`, or null if missing/unparseable. */
function anchorDate(habit: Habit): string | null {
  const raw = habit.createdAt;
  if (!raw || raw.length < 10) return null;
  const datePart = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

/** Whole days from `a` to `b` (both `YYYY-MM-DD`). Noon anchors sidestep DST edges. */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

/** Whether `x` is an exact multiple of `n`, using a positive modulo (JS's `%` can return
 *  negative) so a date BEFORE the anchor still lands on the right phase. */
function isMultipleOf(x: number, n: number): boolean {
  return ((x % n) + n) % n === 0;
}

/** `daily` + `recurrenceInterval` — every Nth day counting from the habit's `createdAt`. */
function dayIntervalMatches(habit: Habit, date: string): boolean {
  const n = habit.recurrenceInterval;
  if (n <= 1) return true;
  const anchor = anchorDate(habit);
  if (!anchor) return true; // fail open — never hide a habit over a missing/bad anchor
  return isMultipleOf(daysBetween(anchor, date), n);
}

/** `weekly` + `recurrenceInterval` — every Nth Mon–Sun week counting from the habit's
 *  `createdAt`'s own week. Weekday membership is checked separately by the caller. */
function weekIntervalMatches(habit: Habit, date: string): boolean {
  const n = habit.recurrenceInterval;
  if (n <= 1) return true;
  const anchor = anchorDate(habit);
  if (!anchor) return true;
  const weeksBetween = daysBetween(getWeekDates(anchor)[0], getWeekDates(date)[0]) / 7;
  return isMultipleOf(weeksBetween, n);
}

/** Sum of `habit`'s logged counts across the Mon–Sun week containing `date`, through `date` inclusive. */
export function habitWeekCountThrough(habit: Habit, logs: HabitLog[], date: string): number {
  const week = getWeekDates(date);
  const idx = week.indexOf(date);
  const upTo = idx >= 0 ? week.slice(0, idx + 1) : week;
  return upTo.reduce((sum, d) => sum + logCount(habit.id, logs, d), 0);
}

/** Whether `habit` is scheduled to appear on `date` per its recurrence setting. */
export function habitOccursOn(habit: Habit, date: string): boolean {
  if (habit.recurrence === 'one-time' || habit.recurrence === 'weekly-flexible') {
    return true;
  }
  if (habit.recurrence === 'daily') {
    return dayIntervalMatches(habit, date);
  }
  const d = new Date(date + 'T12:00:00');
  if (habit.recurrence === 'weekly') {
    if (!weekIntervalMatches(habit, date)) return false;
    if (habit.recurrenceDays.length === 0) return true;
    return habit.recurrenceDays.includes((d.getDay() + 6) % 7); // 0 = Mon
  }
  if (habit.recurrence === 'monthly') {
    if (habit.recurrenceDays.length === 0) return true;
    return d.getDate() === habit.recurrenceDays[0];
  }
  return true;
}

/**
 * Progress toward `habit`'s goal as of `date`: for a fixed-schedule habit, `count` is
 * that day's own log; for `weekly-flexible`, it's the week's cumulative count so far
 * (so "3/3 this week" stays true for the rest of the week once reached).
 */
export function habitProgress(
  habit: Habit,
  logs: HabitLog[],
  date: string
): { count: number; goal: number; ratio: number; isDone: boolean } {
  const count =
    habit.recurrence === 'weekly-flexible'
      ? habitWeekCountThrough(habit, logs, date)
      : logCount(habit.id, logs, date);
  const goal = habit.dailyGoal;
  const ratio = goal > 0 ? Math.min(count / goal, 1) : 0;
  return { count, goal, ratio, isDone: ratio >= 1 };
}

/**
 * Whether `habit` counts as "met" ON `date` specifically (used by the Energy system,
 * which applies a habit's signed value once per qualifying day). A rest day is never
 * met. For a fixed-schedule habit, that's simply that day's own count reaching the
 * goal. For `weekly-flexible`, it's true ONLY on the day the week's cumulative count
 * first crosses the goal — so Energy is awarded once per week, not on every day after.
 */
export function habitMetOn(habit: Habit, logs: HabitLog[], date: string): boolean {
  const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
  if (log?.restDay) return false;
  if (habit.recurrence === 'weekly-flexible') {
    const week = getWeekDates(date);
    const idx = week.indexOf(date);
    const throughToday = habitWeekCountThrough(habit, logs, date);
    const throughYesterday = idx > 0
      ? week.slice(0, idx).reduce((sum, d) => sum + logCount(habit.id, logs, d), 0)
      : 0;
    return throughYesterday < habit.dailyGoal && throughToday >= habit.dailyGoal;
  }
  return (log?.count ?? 0) >= habit.dailyGoal;
}
