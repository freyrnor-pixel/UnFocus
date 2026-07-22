/**
 * habitRecurrence.ts — pure habit occurrence + progress helpers.
 *
 * Extracted (2026-07-22) so the "is this habit due on date X" and "has it been met"
 * logic exists in exactly one place, instead of duplicated across
 * app/(tabs)/health.tsx, lib/widgets/sync.ts, and lib/energy.ts. Also the home of
 * `weekly-flexible` support — a recurrence where the habit is due EVERY day of the
 * week (any day counts) and its goal (`dailyGoal`, reused as a per-week target in
 * this mode) is met once the week's cumulative logged count reaches it, rather than
 * needing specific weekdays picked in advance. Used for goals like "go outside with
 * the kids at least 3x this week" where the days genuinely vary.
 *
 * Connections:
 *   Imports → lib/date (getWeekDates), store/useHabitStore (Habit/HabitLog types)
 *   Used by → lib/energy.ts, app/(tabs)/health.tsx, lib/widgets/sync.ts
 *   Data    → none (pure functions)
 */
import { getWeekDates } from '@/lib/date';
import type { Habit, HabitLog } from '@/store/useHabitStore';

function logCount(habitId: string, logs: HabitLog[], date: string): number {
  const log = logs.find((l) => l.habitId === habitId && l.logDate === date);
  return log?.count ?? 0;
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
  if (habit.recurrence === 'daily' || habit.recurrence === 'one-time' || habit.recurrence === 'weekly-flexible') {
    return true;
  }
  const d = new Date(date + 'T12:00:00');
  if (habit.recurrence === 'weekly') {
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
