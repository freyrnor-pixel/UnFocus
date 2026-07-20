/**
 * taskRecurrence.ts — pure task-occurrence resolution.
 *
 * Extracted from store/useTaskStore.ts (2026-07-20 long-run health pass) so
 * lib/taskNotifications.ts can compute a monthly recurring task's next
 * occurrence without importing the store — store/useTaskStore.ts already
 * imports lib/taskNotifications.ts, so the reverse import would be a cycle.
 *
 * Connections:
 *   Imports → lib/date, store/useTaskStore (type-only — erased at compile time,
 *             so no runtime cycle despite useTaskStore re-exporting taskOccursOn
 *             from here)
 *   Used by → store/useTaskStore.ts (re-exports taskOccursOn for existing
 *             callers/tests, e.g. __tests__/taskOccursOn.test.ts), lib/taskNotifications.ts
 *             (nextOccurrenceDate, for monthly reminders)
 *   Data    → none (pure functions)
 */
import type { Task, MonthOrdinal } from '@/store/useTaskStore';
import { dayOfWeekMon0, dateStr } from '@/lib/date';

const ORDINAL_NUM: Record<Exclude<MonthOrdinal, 'last'>, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
};

/** Local Monday (00:00, noon-anchored) of the week containing `dateStr`. */
function mondayOf(date: string): Date {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() - dayOfWeekMon0(d));
  return d;
}

/** Whole weeks between the Mondays of two dates (b − a); can be negative. */
function weeksBetweenMondays(a: string, b: string): number {
  return Math.round((mondayOf(b).getTime() - mondayOf(a).getTime()) / (7 * 86400000));
}

/**
 * Does `task` have an occurrence on `date` (YYYY-MM-DD)?
 *  - none    → only its own date (a dated one-off; undated Whenever tasks never match a date)
 *  - daily   → every day (from the start boundary, if any)
 *  - weekly  → selected weekday AND on-parity with `weekInterval`, anchored on the
 *              start date (or an epoch Monday when undated)
 *  - monthly → day-of-month (clamped when the month is shorter) OR nth/last weekday
 * `hasStartDate` acts as a start boundary for recurring tasks (no earlier occurrences).
 */
export function taskOccursOn(task: Task, date: string): boolean {
  if (task.recurring === 'none') return task.date === date;
  if (task.hasStartDate && date < task.date) return false;

  const d = new Date(date + 'T12:00:00');
  const mon0 = dayOfWeekMon0(d);

  if (task.recurring === 'daily') return true;

  if (task.recurring === 'weekly') {
    if (!task.recurringDays.includes(mon0)) return false;
    const interval = task.weekInterval > 0 ? task.weekInterval : 1;
    if (interval === 1) return true;
    const anchor = task.hasStartDate ? task.date : '1970-01-05'; // a Monday
    const weeks = weeksBetweenMondays(anchor, date);
    return ((weeks % interval) + interval) % interval === 0;
  }

  // monthly
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (task.monthlyMode === 'ordinal') {
    if (mon0 !== task.monthWeekday) return false;
    const dom = d.getDate();
    if (task.monthOrdinal === 'last') return dom + 7 > daysInMonth;
    return Math.floor((dom - 1) / 7) + 1 === ORDINAL_NUM[task.monthOrdinal];
  }
  const target = Math.min(Math.max(1, task.monthDay), daysInMonth);
  return d.getDate() === target;
}

/**
 * The next date (inclusive of `fromDate`) on which `task` occurs, or null if
 * none falls within `maxDays` of `fromDate`. Used for monthly recurring tasks'
 * reminders, which have no single native repeating trigger that can express
 * "day-of-month, clamped" or "nth/last weekday" — the caller schedules this
 * date as a one-off and re-calls this to re-arm the next one (see
 * lib/taskNotifications.ts and useTaskStore's syncMonthlyTaskNotifications).
 * 62 days comfortably covers the longest possible gap between monthly
 * occurrences (at most one calendar month).
 */
export function nextOccurrenceDate(task: Task, fromDate: string, maxDays = 62): string | null {
  const start = new Date(fromDate + 'T12:00:00');
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = dateStr(d);
    if (taskOccursOn(task, ds)) return ds;
  }
  return null;
}
