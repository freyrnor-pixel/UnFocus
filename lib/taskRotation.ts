/**
 * taskRotation.ts — chores that take turns (2026-07-28, to-do sharing phase 4).
 *
 * A recurring task can rotate through a list of people per day, per week or per month:
 * the bins on Monday, the dishes every other day, the deep clean each month.
 *
 * **Whose turn it is is DERIVED, never stored.** Given the rule (mode + roster + anchor
 * date) and a date, the answer is a pure function — so two paired phones compute the same
 * turn without exchanging anything, and nothing has to write "advance the rotation" on a
 * schedule. That matters more than it looks: a stored current-assignee would need a timed
 * write on every device, and lib/liveSync.ts's last-writer-wins would then have to
 * arbitrate between two devices that both think they advanced it — losing or double-
 * applying turns, silently, on exactly the chore the household is trying to share fairly.
 *
 * Connections:
 *   Imports → lib/date (parseDateStr, getWeekDates), store type import (Task)
 *   Used by → store/useTaskStore.ts (rotation columns), components/TaskCard.tsx (the
 *             rotation editor + the row's "whose turn" cue), app/plans.tsx
 *             (person filter/grouping resolve through effectiveAssigneeId),
 *             lib/__tests__/taskRotation.test.ts
 *   Data    → none (pure functions over values the caller already has)
 *
 * Edit notes:
 *   - **Never recompute `rotationAnchor` for an existing task.** It's the date turn 0
 *     belongs to; moving it reshuffles every past and future turn at once. Set it once,
 *     when rotation is switched on.
 *   - Turn counting uses a floored modulo, so dates BEFORE the anchor wrap backwards
 *     correctly instead of returning a negative index. A task can legitimately be looked
 *     at before its anchor — the week view renders Monday even if rotation was switched on
 *     on Wednesday.
 *   - Day counting goes through UTC midnights on purpose. Subtracting two local Dates
 *     across a DST boundary yields 23 or 25 hours and floors to the wrong day, which would
 *     shift everyone's turn by one for half the year.
 *   - Weekly turns count Mon–Sun weeks (lib/date's `getWeekDates` convention), so a turn
 *     changes at the same boundary the rest of the app calls "a week".
 *   - `effectiveAssigneeId` is the ONE way a caller should ask who a task is for on a given
 *     date. Reading `task.assigneeId` directly silently ignores rotation.
 */
import { getWeekDates, parseDateStr } from '@/lib/date';
import type { Task } from '@/store/useTaskStore';

export type RotationMode = 'none' | 'daily' | 'weekly' | 'monthly';

export const ROTATION_MODES: readonly RotationMode[] = ['none', 'daily', 'weekly', 'monthly'] as const;

/** Total-by-design parse of the stored column — an unknown value means "not rotating". */
export function sanitizeRotationMode(raw: unknown): RotationMode {
  return ROTATION_MODES.includes(raw as RotationMode) ? (raw as RotationMode) : 'none';
}

/** Whole days between two 'YYYY-MM-DD' dates, DST-safe (see the edit note). */
function daysBetween(fromDate: string, toDate: string): number {
  const a = parseDateStr(fromDate);
  const b = parseDateStr(toDate);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

/** Whole Mon–Sun weeks between the weeks containing each date. */
function weeksBetween(fromDate: string, toDate: string): number {
  return Math.round(daysBetween(getWeekDates(fromDate)[0], getWeekDates(toDate)[0]) / 7);
}

/** Whole calendar months between two dates. */
function monthsBetween(fromDate: string, toDate: string): number {
  const a = parseDateStr(fromDate);
  const b = parseDateStr(toDate);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/**
 * How many rotation periods `date` is past `anchor`. Negative before the anchor — callers
 * get a wrapped index from `rotationTurnIndex`, not this.
 */
export function periodsSince(mode: RotationMode, anchor: string, date: string): number {
  if (mode === 'daily') return daysBetween(anchor, date);
  if (mode === 'weekly') return weeksBetween(anchor, date);
  if (mode === 'monthly') return monthsBetween(anchor, date);
  return 0;
}

/**
 * Which slot of the roster has the turn on `date`, or null when the task isn't rotating
 * or has nobody to rotate between. Floored modulo, so dates before the anchor wrap
 * backwards rather than going negative.
 */
export function rotationTurnIndex(
  mode: RotationMode,
  anchor: string,
  rosterLength: number,
  date: string,
): number | null {
  if (mode === 'none' || rosterLength <= 0 || !anchor || !date) return null;
  const n = periodsSince(mode, anchor, date);
  return ((n % rosterLength) + rosterLength) % rosterLength;
}

/**
 * The person whose turn it is on `date`, or '' when the task isn't rotating. A roster
 * entry pointing at a removed person still holds its slot — dropping it would re-index
 * everyone after it and silently change whose turn every future period is.
 */
export function rotationAssigneeFor(task: Task, date: string): string {
  const mode = sanitizeRotationMode(task.rotation);
  // Defensive: these three columns can be absent on a Task object that didn't come from
  // rowToTask — a row written by an older build, or one reconstructed from a backup. A
  // missing roster means "not rotating", never a crash on a render path.
  const roster = task.rotationPersonIds ?? [];
  const index = rotationTurnIndex(mode, task.rotationAnchor ?? '', roster.length, date);
  return index === null ? '' : roster[index] ?? '';
}

/**
 * Who a task is for on a given date — the one function callers should use. Falls back to
 * the fixed `assigneeId` whenever rotation isn't in play, so every existing call site keeps
 * its previous meaning.
 */
export function effectiveAssigneeId(task: Task, date: string): string {
  return rotationAssigneeFor(task, date) || task.assigneeId;
}

/**
 * Is this task rotating in a way that will actually produce turns? A mode with fewer than
 * two people in the roster is a rule that can never change hands, and the UI should treat
 * it as off rather than showing an unchanging "turn".
 */
export function isRotating(task: Task): boolean {
  return sanitizeRotationMode(task.rotation) !== 'none' && (task.rotationPersonIds ?? []).length > 1;
}
