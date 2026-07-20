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
 * These helpers are deliberately pure (they take plain arrays, no store/DB
 * access) so they're trivially unit-testable and reused by
 * components/EnergyMeter.tsx and store/useEnergyStore.ts.
 *
 * Connections:
 *   Imports → lib/date (getWeekDates), store type imports (Task/Habit/HabitLog)
 *   Used by → store/useEnergyStore.ts, components/EnergyMeter.tsx, __tests__/energy.test.ts
 *   Data    → none (pure functions)
 *
 * Period keys (match the energy_budgets table, see lib/db.ts):
 *   - day  → 'YYYY-MM-DD' (the date itself)
 *   - week → 'w:YYYY-MM-DD' (the 'w:'-prefixed Monday of that week)
 */
import { getWeekDates } from '@/lib/date';
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

/** True when a habit counts as "met" on `date` (its logged count reached the daily goal). */
function habitMetOn(habit: Habit, logs: HabitLog[], date: string): boolean {
  const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
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
