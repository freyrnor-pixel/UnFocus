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
 * `weekly-flexible` habits (lib/habitRecurrence.ts — "N times this week, any day")
 * aren't pinned to a specific day, so they're excluded from any single day's planned
 * total and instead added once to the WEEK's planned total.
 *
 * These helpers are deliberately pure (they take plain arrays, no store/DB
 * access) so they're trivially unit-testable and reused by
 * components/EnergyMeter.tsx and store/useEnergyStore.ts.
 *
 * Connections:
 *   Imports → lib/date (getWeekDates), lib/taskRecurrence (taskOccursOn),
 *             lib/habitRecurrence (habitOccursOn, habitMetOn), store type imports
 *             (Task/Habit/HabitLog)
 *   Used by → store/useEnergyStore.ts, components/EnergyMeter.tsx, __tests__/energy.test.ts
 *   Data    → none (pure functions)
 *
 * Period keys (match the energy_budgets table, see lib/db.ts):
 *   - day  → 'YYYY-MM-DD' (the date itself)
 *   - week → 'w:YYYY-MM-DD' (the 'w:'-prefixed Monday of that week)
 */
import { getWeekDates } from '@/lib/date';
import { taskOccursOn } from '@/lib/taskRecurrence';
import { habitOccursOn, habitMetOn } from '@/lib/habitRecurrence';
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

/**
 * Net signed energy PLANNED for a day: every energy-enabled task/habit scheduled
 * to occur that day, regardless of whether it's been completed/met yet — unlike
 * energyDeltaForDay, which only counts what's actually done. Used to warn about an
 * over-committed day before anything on it has happened. `weekly-flexible` habits
 * are excluded here (see plannedEnergyDeltaForWeek) since they aren't pinned to a
 * specific day.
 */
export function plannedEnergyDeltaForDay(date: string, tasks: Task[], habits: Habit[]): number {
  let total = 0;
  for (const t of tasks) {
    if (t.energyEnabled && taskOccursOn(t, date)) total += t.energyValue;
  }
  for (const h of habits) {
    if (h.energyEnabled && h.recurrence !== 'weekly-flexible' && habitOccursOn(h, date)) total += h.energyValue;
  }
  return total;
}

/**
 * Net signed energy PLANNED across the Mon–Sun week containing `date` (see
 * plannedEnergyDeltaForDay). Each `weekly-flexible` habit's value is added exactly
 * ONCE for the week (it isn't pinned to any single day, so it can't be summed per-day
 * without over-counting it up to 7x).
 */
export function plannedEnergyDeltaForWeek(date: string, tasks: Task[], habits: Habit[]): number {
  const dayTotal = getWeekDates(date).reduce((sum, d) => sum + plannedEnergyDeltaForDay(d, tasks, habits), 0);
  const flexibleTotal = habits.reduce(
    (sum, h) => sum + (h.energyEnabled && h.recurrence === 'weekly-flexible' ? h.energyValue : 0),
    0
  );
  return dayTotal + flexibleTotal;
}
