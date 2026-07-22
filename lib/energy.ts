/**
 * energy.ts — pure helpers for the optional Energy system (2026-07-20).
 *
 * The Energy system gives each task/habit an optional SIGNED energy value
 * (positive restores energy — e.g. drinking water = +1 — negative drains it).
 * The user sets a daily and weekly energy CAPACITY (a budget); completing an
 * energy task or meeting an energy habit applies its value to that day's and
 * week's budget. "Current" energy for a period = capacity + the net of every
 * value applied in it.
 *
 * Also computes "planned" energy (2026-07-22) — the same net-value sum but over
 * every energy task/habit SCHEDULED for the period, regardless of done/met status.
 * This answers "if everything on the books happens, do I have enough Energy?",
 * distinct from "current" which only reflects what's already been completed —
 * used to warn about an over-committed day/week before anything's done.
 *
 * These helpers are deliberately pure (they take plain arrays, no store/DB
 * access) so they're trivially unit-testable and reused by
 * components/EnergyMeter.tsx and store/useEnergyStore.ts.
 *
 * Connections:
 *   Imports → lib/date (getWeekDates), lib/taskRecurrence (taskOccursOn),
 *             store type imports (Task/Habit/HabitLog)
 *   Used by → store/useEnergyStore.ts, components/EnergyMeter.tsx, __tests__/energy.test.ts
 *   Data    → none (pure functions)
 *
 * Period keys (match the energy_budgets table, see lib/db.ts):
 *   - day  → 'YYYY-MM-DD' (the date itself)
 *   - week → 'w:YYYY-MM-DD' (the 'w:'-prefixed Monday of that week)
 */
import { getWeekDates } from '@/lib/date';
import { taskOccursOn } from '@/lib/taskRecurrence';
import type { Task } from '@/store/useTaskStore';
import type { Habit, HabitLog } from '@/store/useHabitStore';

/** Day period key for a 'YYYY-MM-DD' date (identity — kept as a named helper for symmetry). */
export function dayKey(date: string): string {
  return date;
}

/** Week period key ('w:'-prefixed Monday) for the Mon–Sun week containing `date`. */
export function weekKey(date: string): string {
  return `w:${getWeekDates(date)[0]}`;
}

/**
 * True when a habit counts as "met" on `date` (its logged count reached the daily goal).
 * A rest day is neither met nor missed — it's excluded so energy simply doesn't move for
 * that habit that day (no reward for resting, no penalty either).
 */
function habitMetOn(habit: Habit, logs: HabitLog[], date: string): boolean {
  const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
  if (log?.restDay) return false;
  return (log?.count ?? 0) >= habit.dailyGoal;
}

/**
 * Net signed energy applied on a single day: sum of every energy-enabled task
 * completed with that date, plus every energy-enabled habit met that day.
 */
export function energyDeltaForDay(
  date: string,
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[]
): number {
  let total = 0;
  for (const t of tasks) {
    if (t.energyEnabled && t.done && t.date === date) total += t.energyValue;
  }
  for (const h of habits) {
    if (h.energyEnabled && habitMetOn(h, habitLogs, date)) total += h.energyValue;
  }
  return total;
}

/** Net signed energy applied across the Mon–Sun week containing `date`. */
export function energyDeltaForWeek(
  date: string,
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[]
): number {
  return getWeekDates(date).reduce(
    (sum, d) => sum + energyDeltaForDay(d, tasks, habits, habitLogs),
    0
  );
}

/** Whether `habit` is scheduled to occur on `date` — mirrors dueToday()/shouldShowHabitOnDate() elsewhere. */
function habitOccursOn(habit: Habit, date: string): boolean {
  if (habit.recurrence === 'daily' || habit.recurrence === 'one-time') return true;
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
 * Net signed energy PLANNED for a day: every energy-enabled task/habit scheduled
 * to occur that day, regardless of whether it's been completed/met yet — unlike
 * energyDeltaForDay, which only counts what's actually done. Used to warn about an
 * over-committed day before anything on it has happened.
 */
export function plannedEnergyDeltaForDay(date: string, tasks: Task[], habits: Habit[]): number {
  let total = 0;
  for (const t of tasks) {
    if (t.energyEnabled && taskOccursOn(t, date)) total += t.energyValue;
  }
  for (const h of habits) {
    if (h.energyEnabled && habitOccursOn(h, date)) total += h.energyValue;
  }
  return total;
}

/** Net signed energy PLANNED across the Mon–Sun week containing `date` (see plannedEnergyDeltaForDay). */
export function plannedEnergyDeltaForWeek(date: string, tasks: Task[], habits: Habit[]): number {
  return getWeekDates(date).reduce((sum, d) => sum + plannedEnergyDeltaForDay(d, tasks, habits), 0);
}
