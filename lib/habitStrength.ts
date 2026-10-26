/**
 * habitStrength.ts — how established one habit is, 0…1, from its own log (2026-10-26).
 *
 * Loop Habit Tracker's score (uhabits-core Score.kt) — an exponential moving average whose
 * half-life scales with how often the habit is due — computed per OCCURRENCE instead of per
 * calendar day, because this app's schedules are explicit (habitOccursOn) where Loop's are a
 * frequency. With Loop's constant: a daily habit's half-life is 13 occurrences, a once-a-week
 * one ~5, a monthly one ~2.4. Table Habit's two additions ride along:
 *   - **Partial credit.** An occurrence scores count/goal, so 2 of 3 glasses is 0.67, not 0.
 *   - **Rest days don't count.** A rest day is skipped entirely — neither up nor down —
 *     exactly as habitMetOn already treats it for Energy.
 * And one rule of this app's own: **today never counts against you.** Today's occurrence is
 * only folded in once something is logged; an unlogged today is a day that isn't over.
 *
 * It is a level, never a streak: there is nothing to break, one gap costs a sliver, and the
 * surface shows a word and a bar, never the number (see app/habit-form.tsx).
 *
 * Connections:
 *   Imports → lib/date (addDays, getWeekDates, utcStampToLocalDate), lib/habitRecurrence
 *             (habitOccursOn), store/useHabitStore (Habit/HabitLog types only)
 *   Used by → app/habit-form.tsx (the strength row on an existing habit),
 *             lib/__tests__/habitStrength.test.ts
 *   Data    → none (pure)
 */
import { addDays, getWeekDates, utcStampToLocalDate } from '@/lib/date';
import { habitOccursOn } from '@/lib/habitRecurrence';
import type { Habit, HabitLog } from '@/store/useHabitStore';

/** Loop's constant: a once-a-day habit's score halves after 13 missed days. */
const LOOP_HALF_LIFE = 13;

/** How far back the scan walks at most (habit_logs is pruned at 365 days anyway). */
export const STRENGTH_SCAN_DAYS = 365;

export type StrengthLevel = 'new' | 'growing' | 'strong' | 'established';

/** Roughly how many times per day the habit is due — Loop's `frequency`. */
export function dueFrequency(habit: Habit): number {
  const n = Math.max(1, habit.recurrenceInterval || 1);
  switch (habit.recurrence) {
    case 'daily':
      return 1 / n;
    case 'weekly':
      return (habit.recurrenceDays.length || 1) / (7 * n);
    case 'monthly':
      return 1 / 30;
    case 'weekly-flexible':
      return 1 / 7; // one occurrence per week (the week is the unit), see below
    default:
      return 1;
  }
}

/** The per-occurrence decay multiplier: half-life = 13·√frequency occurrences. */
function multiplier(habit: Habit): number {
  const halfLife = LOOP_HALF_LIFE * Math.sqrt(dueFrequency(habit));
  return Math.pow(0.5, 1 / Math.max(0.5, halfLife));
}

/**
 * Strength in [0, 1], or null for a habit that has no repeating schedule ('one-time').
 * `logs` may hold other habits' rows; only this habit's are read.
 */
export function habitStrength(habit: Habit, logs: HabitLog[], today: string): number | null {
  if (habit.recurrence === 'one-time') return null;
  const goal = Math.max(1, habit.dailyGoal || 1);
  const mine = new Map<string, HabitLog>();
  for (const l of logs) if (l.habitId === habit.id) mine.set(l.logDate, l);

  const created = utcStampToLocalDate(habit.createdAt) ?? addDays(today, -(STRENGTH_SCAN_DAYS - 1));
  const earliest = addDays(today, -(STRENGTH_SCAN_DAYS - 1));
  const from = created > earliest ? created : earliest;
  const m = multiplier(habit);
  let score = 0;
  const fold = (value: number) => {
    score = score * m + Math.min(1, Math.max(0, value)) * (1 - m);
  };

  if (habit.recurrence === 'weekly-flexible') {
    // One occurrence per Mon–Sun week: the week's total against the weekly target.
    for (let wk = getWeekDates(from)[0]; wk <= today; wk = addDays(wk, 7)) {
      const days = getWeekDates(wk);
      const isThisWeek = days.includes(today);
      const total = days.filter((d) => d <= today).reduce((sum, d) => sum + (mine.get(d)?.count ?? 0), 0);
      if (isThisWeek && total < goal) {
        if (total > 0) fold(total / goal); // partial week counts only once it's started
        continue;
      }
      fold(total / goal);
    }
    return score;
  }

  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!habitOccursOn(habit, d)) continue;
    const log = mine.get(d);
    if (log?.restDay) continue;
    const count = log?.count ?? 0;
    if (d === today && count === 0) continue; // today isn't over
    fold(count / goal);
  }
  return score;
}

/** The word the form shows instead of a number. */
export function strengthLevel(score: number): StrengthLevel {
  if (score < 0.25) return 'new';
  if (score < 0.5) return 'growing';
  if (score < 0.8) return 'strong';
  return 'established';
}
