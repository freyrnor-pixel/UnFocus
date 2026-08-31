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
 * `energyDeltaForDay` spends a **stepped** card's value proportionally per step rather than
 * all at once on completion, and never spends a **note** card's at all (2026-08-01) — the
 * rule itself lives in lib/cardType.ts so this file and the cards can't disagree. Planned
 * energy still counts a stepped card's full value; see that function's own note.
 *
 * Connections:
 *   Imports → lib/date (getWeekDates), lib/cardType (energySpentFraction, isCompletable),
 *             lib/taskRecurrence (taskOccursOn),
 *             lib/habitRecurrence (habitOccursOn, habitMetOn), store type imports
 *             (Task/Habit/HabitLog)
 *   Used by → store/useEnergyStore.ts, components/EnergyMeter.tsx, lib/useEnergyPause.ts,
 *             __tests__/energy.test.ts
 *   Data    → none (pure functions)
 *
 * Period keys (match the energy_budgets table, see lib/db.ts):
 *   - day   → 'YYYY-MM-DD' (the date itself)
 *   - week  → 'w:YYYY-MM-DD' (the 'w:'-prefixed Monday of that week)
 *   - boost → 'b:YYYY-MM-DD' (2026-08-02 — today-only extra energy, ADDED to the day's
 *             base capacity rather than replacing it; see boostKey below)
 */
import { getWeekDates } from '@/lib/date';
import { energySpentFraction, isCompletable } from '@/lib/cardType';
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
 * How many surplus pips the meter may ever draw past a full bar.
 *
 * The pip row clips (`pipRowInline` in components/EnergyMeter.tsx), so an uncapped surplus
 * on a day that went well would paint straight over the `7 / 10` value text beside it —
 * the exact overflow bug fixed on 2026-07-28. A cap keeps "you have more than a full day
 * left" legible as a shape rather than as an ever-growing count, which also matches the
 * feature's own rule that nothing here is a number to chase.
 */
export const MAX_SURPLUS_PIPS = 4;

/**
 * Discrete pip count for the Home card's bolt-row meter. 1 pip per unit of capacity up
 * to `maxPips`; past that, pips represent a proportional share so a large weekly
 * capacity (e.g. 40) still renders as a handful of icons instead of 40 of them.
 * `filled` is clamped to [0, pipCount] — a negative current (over-committed) fills
 * none, and current above capacity fills all of them.
 *
 * `surplus` (2026-08-02) is what the clamp used to swallow: pips EARNED past capacity, so
 * `12 / 10` no longer draws identically to `10 / 10`. It is scaled exactly like `filled`
 * (the same `pipCount`-per-capacity ratio, so one surplus pip means the same amount as one
 * filled pip) and capped at `MAX_SURPLUS_PIPS`. It is 0 whenever `current <= capacity`, and
 * 0 for a zero/negative capacity along with everything else.
 */
/**
 * The most pips a meter row ever draws — the ceiling `energyPipCount` scales a large capacity
 * down to. Exported since 2026-09-01 so `components/EnergyMeter.tsx`'s empty-state row can draw
 * exactly as many placeholders as a full meter has pips; it was a default parameter, and a
 * literal `10` at that call site would be the same number in two places.
 */
export const MAX_PIPS = 10;

export function energyPipCount(
  current: number,
  capacity: number,
  maxPips = MAX_PIPS
): { pipCount: number; filled: number; surplus: number } {
  if (capacity <= 0) return { pipCount: 0, filled: 0, surplus: 0 };
  const pipCount = Math.min(maxPips, capacity);
  const ratio = Math.max(0, Math.min(1, current / capacity));
  const over = current > capacity ? Math.round(((current - capacity) / capacity) * pipCount) : 0;
  return {
    pipCount,
    filled: Math.round(ratio * pipCount),
    surplus: Math.max(0, Math.min(MAX_SURPLUS_PIPS, over)),
  };
}

/** Week period key ('w:'-prefixed Monday) for the Mon–Sun week containing `date`. */
export function weekKey(date: string): string {
  return `w:${getWeekDates(date)[0]}`;
}

/**
 * Boost period key ('b:'-prefixed date) — the TODAY-ONLY extra energy added on top of a
 * day's base capacity (2026-08-02).
 *
 * Deliberately a third key shape in the same `energy_budgets` table rather than a column or
 * a new table: it needs no migration, and — more importantly — it keeps the boost SEPARATE
 * from the day override the ✏️ editor writes. Folding "+3 because today is a good day" into
 * the override would silently redefine the user's usual capacity, so tomorrow would inherit
 * a number they only ever meant for one day.
 *
 * Note lib/db.ts's retention prune needs its own line for these: the existing day-key prune
 * matches `GLOB '____-__-__'`, which `b:2026-08-02` does not.
 */
export function boostKey(date: string): string {
  return `b:${date}`;
}

/**
 * One decimal place, and only where a fraction can actually arise.
 *
 * Every energy value the user can enter is a whole number, so these sums were integers
 * until stepped cards started spending a fraction of one (see energyDeltaForDay). Without
 * this, a third of a step's worth renders as `6.300000000000001` in
 * components/EnergyMeter.tsx, which prints `current` raw. Rounding an integer is a no-op,
 * so nothing that predates stepped cards changes.
 */
function roundEnergy(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Net signed energy applied on a single day: sum of every energy-enabled task
 * completed with that date, plus every energy-enabled habit met that day.
 *
 * **Stepped cards spend proportionally** (2026-08-01): a stepped task's value is applied
 * one step at a time — 3 of 6 steps done spends half — instead of landing all at once on
 * completion. Every other card type is unchanged, all-or-nothing on `done`; a 'note' never
 * spends anything at all. The whole rule lives in lib/cardType.ts's `energySpentFraction`
 * so the pure helper here can't drift from what the card draws.
 *
 * Note this is the CURRENT (already-spent) figure. `plannedEnergyDeltaForDay` deliberately
 * still counts a stepped task's FULL value: it answers "if everything on the books happens,
 * do I have enough", and all of a stepped task's steps happening is all of its cost.
 */
export function energyDeltaForDay(
  date: string,
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[]
): number {
  let total = 0;
  for (const t of tasks) {
    if (!t.energyEnabled || t.date !== date) continue;
    total += t.energyValue * energySpentFraction(t.cardType, t.done, t.steps);
  }
  for (const h of habits) {
    if (h.energyEnabled && habitMetOn(h, habitLogs, date)) total += h.energyValue;
  }
  return roundEnergy(total);
}

/** Net signed energy applied across the Mon–Sun week containing `date`. */
export function energyDeltaForWeek(
  date: string,
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[]
): number {
  return roundEnergy(
    getWeekDates(date).reduce((sum, d) => sum + energyDeltaForDay(d, tasks, habits, habitLogs), 0)
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
    // A 'note' is information parked in the list, not work — it costs nothing now and
    // nothing later, so it stays out of the planned total as well as the current one.
    if (t.energyEnabled && isCompletable(t.cardType) && taskOccursOn(t, date)) total += t.energyValue;
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
