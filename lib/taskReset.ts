/**
 * taskReset.ts — the state-based reset: pure rules that keep a to-do list from
 * accumulating a past (2026-08-17).
 *
 * Three rules, one file, no stored counters anywhere in any of them:
 *
 *   1. **Recurring normalization (state over count).** A recurring daily/weekly task whose
 *      row still carries an earlier day is rolled forward to today, and a completion that
 *      belonged to that earlier day is cleared. Nothing is created and nothing is counted:
 *      a task has exactly two states, still to do or done, and yesterday's answer is not
 *      one of them. `recurringResetPatch` returns the patch, or null when the row is
 *      already current — an already-normalized list is a no-op, which is what lets the
 *      caller run this on every boot and every foreground.
 *   2. **"Not today".** `notTodayDate` is the whole rule: tomorrow. The action writes a
 *      date and nothing else — no skip counter, no streak break, no "postponed n times"
 *      badge. There is deliberately no function here that records that it happened.
 *   3. **Washing away (the clean canvas).** A non-recurring task nobody has touched for
 *      `WASH_AWAY_HOURS` stops being drawn in the active list and is reachable in one tap
 *      from the "Washed away" drawer instead. It is a FILTER, not a move: nothing is
 *      written when a task washes away, nothing is deleted, and bringing one back is just
 *      a fresh `lastActedAt`. Same derived-not-stored discipline as lib/taskRotation.ts's
 *      turn and lib/cardType.ts's current step.
 *
 * **Nothing here is allowed to grow a number.** No overdue count, no "days late", no
 * escalation with age, no colour that gets angrier — a washed-away task from March reads
 * exactly like one from yesterday, the same promise lib/episodes.ts makes about a
 * week-old episode. `lib/__tests__/taskReset.test.ts` asserts the absence.
 *
 * Deliberately dependency-free apart from lib/date and lib/cardType (both themselves pure)
 * — same rule as lib/cardLayout.ts and lib/cardType.ts, so the store, the screens and the
 * tests can share ONE set of rules with no import cycle. Do not reach a store from here;
 * pass what you need in.
 *
 * Connections:
 *   Imports → lib/date (addDays, dayOfWeekMon0), lib/cardType (isCompletable),
 *             store/useTaskStore (type-only — erased at compile time, so no runtime cycle)
 *   Used by → store/useTaskStore.ts (normalizeRecurringTasks / notToday / washedAwayTasks /
 *             bringBack), app/(tabs)/plans.tsx (the active-list filter + the "Washed away"
 *             drawer), components/TaskCard.tsx (whether to draw "Not today")
 *   Data    → none (pure functions)
 *
 * Edit notes:
 *   - **Monthly recurrence is deliberately OUT of the normalization.** A monthly task's
 *     `task_date` is a start boundary the user picked on a real calendar, its occurrences
 *     are weeks apart, and the schema has no per-occurrence completion row — so "was this
 *     done for THIS month" cannot be answered by rolling a single date forward a day at a
 *     time without making "done" mean "done since yesterday". Daily and weekly are what
 *     the reset covers; a monthly reset needs a record this table doesn't have.
 *   - **The known cost of clearing `done`**, stated so it reads as a decision: the day log
 *     (lib/dayLog.ts) files a completed task under `task.date`, so once a recurring task
 *     rolls forward, its completion no longer appears in the PAST day's log. The
 *     alternative is a recurring task that reads "done" forever and never comes back —
 *     which is worse, and is the bug this fixes. A faithful per-day record of recurring
 *     completions needs its own table, the way habits have `habit_logs`.
 *   - **Weekly parity is preserved, which is why the roll-forward is not always `today`.**
 *     lib/taskRecurrence.ts anchors a `weekInterval > 1` task's parity on `task.date` when
 *     `hasStartDate` is set, so stamping today would silently move an every-other-week
 *     task onto the other week. Those roll forward by WHOLE intervals instead. Every other
 *     case (daily, weekly-every-week, and anything undated, whose parity is anchored on an
 *     epoch Monday instead) lands on today exactly as the brief asks.
 *   - **`isWashedAway` fails SAFE.** An unparseable or missing `lastActedAt` returns false,
 *     i.e. the task stays visible. Hiding a row is the outcome that loses work, so an
 *     unknown answer must never produce it.
 */
import { addDays, dayOfWeekMon0 } from '@/lib/date';
import { isCompletable } from '@/lib/cardType';
import type { Task } from '@/store/useTaskStore';

/**
 * How long a non-recurring task may sit untouched before it washes out of the active list.
 * 72 hours — three days, so a thing parked on Friday is still there on Monday morning.
 */
export const WASH_AWAY_HOURS = 72;

/** The fields the recurring reset reads. A full `Task` satisfies it. */
export type ResettableTask = Pick<
  Task,
  'date' | 'done' | 'doneAt' | 'recurring' | 'weekInterval' | 'hasStartDate'
>;

/** The fields the wash-away filter reads. A full `Task` satisfies it. */
export type DecayableTask = Pick<
  Task,
  'date' | 'done' | 'recurring' | 'hasStartDate' | 'cardType' | 'lastActedAt'
>;

/** The patch `recurringResetPatch` hands back — never anything but these three fields. */
export type RecurringResetPatch = { date: string; done?: false; doneAt?: '' };

/** Whole weeks between the Mondays of two dates (b − a). Mirrors lib/taskRecurrence.ts. */
function weeksBetweenMondays(a: string, b: string): number {
  const mondayOf = (date: string): number => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - dayOfWeekMon0(d));
    return d.getTime();
  };
  return Math.round((mondayOf(b) - mondayOf(a)) / (7 * 86400000));
}

/**
 * The date a recurring daily/weekly task's row should carry today, or null when it should
 * not move (already current, not a daily/weekly task, or a parity roll that would land
 * before the date it already has).
 */
function rolledForwardDate(task: ResettableTask, today: string): string | null {
  if (task.recurring !== 'daily' && task.recurring !== 'weekly') return null;
  if (task.date >= today) return null;

  const interval = task.weekInterval > 0 ? task.weekInterval : 1;
  // Parity is only anchored on this row's own date for an every-n-weeks task that HAS a
  // start date; everything else is anchored on an epoch Monday (or not at all), so today
  // is free. See lib/taskRecurrence.ts's `taskOccursOn`.
  if (task.recurring !== 'weekly' || interval === 1 || !task.hasStartDate) return today;

  const offsetWeeks = weeksBetweenMondays(task.date, today) % interval;
  const rolled = addDays(today, -offsetWeeks * 7);
  return rolled > task.date ? rolled : null;
}

/**
 * The patch that brings one recurring task up to date, or null if it is already current.
 *
 * Returning null for a no-op is load-bearing: the caller runs this over every task on
 * every boot and every foreground, and only writes the rows that come back non-null.
 */
export function recurringResetPatch(task: ResettableTask, today: string): RecurringResetPatch | null {
  const date = rolledForwardDate(task, today);
  if (!date) return null;
  // The completion belonged to the day the row was carrying, which is now behind us. There
  // is no third state to fall into: the task is simply still to do again.
  return task.done || task.doneAt ? { date, done: false, doneAt: '' } : { date };
}

/** Where "Not today" puts a task: tomorrow. That is the entire rule. */
export function notTodayDate(today: string): string {
  return addDays(today, 1);
}

/**
 * Can this task be pushed to tomorrow?
 *
 * Recurring tasks are excluded for the same reason components/TaskCard.tsx's
 * "Move to Whenever" shortcut excludes them: their `hasStartDate`/`date` pair is a
 * scheduling boundary, not the day they happen on, so writing tomorrow into it would
 * retime a whole series rather than skip one day. A finished task has nothing to push.
 */
export function canPostpone(task: Pick<Task, 'recurring' | 'done' | 'cardType'>): boolean {
  return task.recurring === 'none' && !task.done && isCompletable(task.cardType);
}

/**
 * Hours between `stamp` (an ISO-8601 UTC instant) and `nowMs`, or null when the stamp is
 * missing or unreadable.
 *
 * Tolerant of the SQLite `datetime('now')` shape (`YYYY-MM-DD HH:MM:SS`, also UTC) as well
 * as ISO, because the back-fill migration in lib/db.ts seeds this column from `created_at`
 * and a row written before that normalization landed can still carry the space form. The
 * same UTC/local trap lib/date.ts's `utcStampToLocalMinutes` documents applies: the space
 * form is parsed as LOCAL by some engines, so it is converted to the `T…Z` shape first.
 */
export function hoursSinceStamp(stamp: string, nowMs: number): number | null {
  if (!stamp) return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(stamp)
    ? stamp.replace(' ', 'T') + 'Z'
    : stamp;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return (nowMs - at) / 3600000;
}

/**
 * Has this task washed out of the active list?
 *
 * Four exclusions, each a decision rather than an omission:
 *   - **recurring** — it comes back by itself; rule 1 above is its reset.
 *   - **done** — finished, and already behind the section's own "Done" zone.
 *   - **a note** — parked information, not work (lib/cardType.ts). Sweeping one away
 *     hides something the user deliberately wrote down and will not think to look for.
 *   - **dated today or later** — a task booked for next Thursday is not being ignored,
 *     however long ago it was written.
 */
export function isWashedAway(task: DecayableTask, today: string, nowMs: number): boolean {
  if (task.recurring !== 'none' || task.done) return false;
  if (!isCompletable(task.cardType)) return false;
  if (task.hasStartDate && task.date >= today) return false;
  const hours = hoursSinceStamp(task.lastActedAt, nowMs);
  // Unknown → visible. See the header: hiding a row is the outcome that loses work.
  if (hours === null) return false;
  return hours > WASH_AWAY_HOURS;
}
