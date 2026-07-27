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
 * `energyPipCount()` (2026-07-27) turns a current/capacity pair into a small number of
 * discrete "pips" for the Home card's bolt-row meter — 1:1 up to `maxPips`, then scaled
 * down proportionally so a large weekly capacity doesn't render 40 icons.
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

/**
 * The two halves of the single-stepper Energy control (2026-07-26 clarity pass).
 *
 * The editors used to show a switch (`energyEnabled`) plus a value stepper (`energyValue`)
 * — two controls for one number, since the sums below already ignore a row whose flag is
 * off. They now show ONE signed stepper where 0 means "no effect".
 *
 * The trap this encodes: `energyValue` defaults to **1** in both stores while
 * `energyEnabled` defaults to **false**, so the stored value is meaningless until the flag
 * is on. Rendering it raw would show every untouched task/habit as "+1" and then persist
 * that on the next save, silently opting it into the Energy system.
 *
 * Used by components/TaskCard.tsx and app/habit-form.tsx — keep them going through these
 * so the two editors can't drift apart on the rule.
 */
export function energyStepperValue(energyEnabled: boolean, energyValue: number): number {
  return energyEnabled ? energyValue : 0;
}

/** Inverse of energyStepperValue: the fields to persist for a given stepper reading. */
export function energyFieldsFromStepper(shown: number): { energyEnabled: boolean; energyValue: number } {
  return { energyEnabled: shown !== 0, energyValue: shown };
}

/**
 * Discrete pip count for the Home card's bolt-row meter. 1 pip per unit of capacity up
 * to `maxPips`; past that, pips represent a proportional share so a large weekly
 * capacity (e.g. 40) still renders as a handful of icons instead of 40 of them.
 * `filled` is clamped to [0, pipCount] — a negative current (over-committed) fills
 * none, and current above capacity fills all of them.
 */
export function energyPipCount(
  current: number,
  capacity: number,
  maxPips = 10
): { pipCount: number; filled: number } {
  if (capacity <= 0) return { pipCount: 0, filled: 0 };
  const pipCount = Math.min(maxPips, capacity);
  const ratio = Math.max(0, Math.min(1, current / capacity));
  return { pipCount, filled: Math.round(ratio * pipCount) };
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
