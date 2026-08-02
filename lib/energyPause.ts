/**
 * energyPause.ts — the two pure rules behind the daily energy pause (2026-08-02).
 *
 * The pause replaces the meter's old amber "⚠️ Today is planned to use 3 more Energy than
 * you have available" line — the loudest piece of guilt copy left in the app — with one calm
 * control and a sheet offering two equal-weight ways out: **I'll decide** (pin one card, let
 * the rest keep) and **I'm good** (stop showing energy for the rest of the day). Neither is
 * the "correct" answer and neither is recorded as one; see lib/energyDayState.ts.
 *
 * Two things live here and nothing else:
 *
 *   - `isOverBudget` collapses the two conditions the removed warning rows covered — spent
 *     energy past capacity (`current <= 0`) and PLANNED energy past capacity
 *     (`plannedOver > 0`) — into the single indicator the spec asks for. One state, one
 *     control, one sheet, rather than two lines that could contradict each other.
 *   - `decideCandidates` picks the handful of cards "I'll decide" offers. At most FOUR:
 *     the whole point of the sheet is that the day is already too big, so a scrolling list
 *     of everything would be the problem restated rather than a way out of it.
 *
 * Deliberately dependency-free (plain arrays in, plain arrays out) like lib/cardLayout.ts,
 * lib/cardType.ts and lib/growth.ts — no store, no DB, no notifications. If you need store
 * state here, pass it in.
 *
 * **This feature never notifies, at any horizon.** Being over budget is not an alert; a push
 * about it would be exactly the nag the pause exists to remove. That is a product promise
 * with no other enforcement, so lib/__tests__/energyPause.test.ts source-scans this module,
 * lib/energyDayState.ts and lib/useEnergyPause.ts for notification APIs and asserts zero
 * hits — the same technique lib/__tests__/episodes.test.ts uses.
 *
 * Connections:
 *   Imports → lib/cardType (isCompletable), store/useTaskStore (TYPE ONLY — no runtime dep)
 *   Used by → lib/useEnergyPause.ts, lib/__tests__/energyPause.test.ts
 *   Data    → none (pure functions)
 *
 * Edit notes:
 *   - `current` is already capacity-relative: the meter computes it as
 *     `capacityForDay(today) + energyDeltaForDay(...)`, so 0 means "exactly spent" and
 *     negative means "past it". Don't pass a raw delta.
 *   - `plannedOver` is the POSITIVE overshoot the meter derives as
 *     `-Math.min(0, capacity + plannedEnergyDeltaForDay(...))` — 0 when the plan fits.
 *   - Candidates are filtered by `t.date === date`, matching how `energyDeltaForDay`
 *     attributes spent energy to a day. A recurrence-aware filter would need
 *     lib/taskRecurrence, and this module stays dependency-free on purpose.
 *   - A 'note' card has no completion state at all (lib/cardType.ts's `isCompletable`), so
 *     it can never be the one thing you do next and never appears here.
 */
import { isCompletable } from '@/lib/cardType';
import type { Task } from '@/store/useTaskStore';

/** The most cards "I'll decide" will ever offer. Four is a glance; a list is the problem again. */
export const MAX_DECIDE_CANDIDATES = 4;

/**
 * Is today over its energy, by either route?
 *
 * `current <= 0` — what has already been done has used the day up.
 * `plannedOver > 0` — what is still on the books would use more than the day has.
 *
 * Either one alone is enough. They used to be two separate lines in two separate colours
 * (an amber warning and a muted "fully spent" note) which could both be on screen at once
 * saying the same thing twice; the whole point of one predicate is that there is now one
 * calm indicator either way.
 */
export function isOverBudget(current: number, plannedOver: number): boolean {
  return current <= 0 || plannedOver > 0;
}

/**
 * How much a task takes out of the day, as a positive number.
 *
 * `energyValue` is SIGNED (positive restores, negative drains) and only means anything when
 * `energyEnabled` — the store defaults it to 1 with the flag off, so reading it raw would
 * price every untouched task at 1 (see lib/energy.ts's `energyStepperValue` for the same
 * trap). A restoring task therefore scores below zero and sorts first, which is right: on a
 * day that is already over, the cheapest thing to do next is the thing that gives back.
 */
function drain(task: Task): number {
  return task.energyEnabled ? -task.energyValue : 0;
}

/** A task the clock already has an opinion about — a chosen date or a time on it. */
function isHardDated(task: Task): boolean {
  return task.hasStartDate || !!task.time;
}

/**
 * The cards "I'll decide" offers: up to four of today's unfinished, completable tasks,
 * cheapest first, then the ones the clock has already pinned down.
 *
 * The order is the recommendation. Nothing here is scored, ranked out of anything, or
 * labelled "best" — the sheet just puts the least costly options where the eye lands first,
 * and the user picks one. Ties keep their incoming order (`sort` is stable), so a list the
 * user has dragged into shape stays in that shape within a tier.
 */
export function decideCandidates(tasks: Task[], date: string): Task[] {
  return tasks
    .filter((t) => t.date === date && !t.done && isCompletable(t.cardType))
    .sort((a, b) => {
      const byCost = drain(a) - drain(b);
      if (byCost !== 0) return byCost;
      return Number(isHardDated(b)) - Number(isHardDated(a));
    })
    .slice(0, MAX_DECIDE_CANDIDATES);
}
