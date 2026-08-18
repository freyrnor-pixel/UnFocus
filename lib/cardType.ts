/**
 * cardType.ts — pure rules for the four per-item card types (2026-08-01, phase 1).
 *
 * A card type is a property of ONE to-do item — never of the list, never a global setting.
 * That is the whole distinction from lib/cardLayout.ts, which is per-SURFACE ("how does
 * this list draw itself") and per-user. The two stack as filters and only ever subtract:
 * the card type decides what an item is allowed to show, the layout may then hide more.
 * Neither can add a cue back.
 *
 *   standard  the existing card, unchanged — title, energy, due chip, meta line
 *   simple    title + check only. Energy/time/tags/goal are still STORED and still fire
 *             their reminders; the row just doesn't draw them. Costs nothing to create,
 *             so a trivial task gets captured instead of skipped.
 *   note      free text. No check, no completion state, no energy. It is information
 *             parked in the list, not work — see `isCompletable` for everything that
 *             follows from that.
 *   stepped   an ordered list of steps, exactly ONE visible at a time. Breaks an
 *             under-specified task into something startable.
 *
 * **The current step is DERIVED, never stored.** It is the first not-done step, full stop.
 * A stored `currentStepIndex` would be a second source of truth that drifts the moment a
 * step is ticked from anywhere else — the widget's `UPDATE task_steps` (lib/widgets/
 * widgetActions.ts), the task↔steps done-cascade, or a future sync — which is the same
 * trap `episode_state` (lib/episodes.ts) and rotation (lib/taskRotation.ts) document.
 * Deriving it also makes "step backwards to undo" free: unticking a step IS stepping back,
 * and it persists because task_steps writes straight to SQLite on every change.
 *
 * **Partial progress is progress, never failure.** `steppedProgress` returns a done/total
 * pair and nothing else — no ratio thresholds, no "behind", no reset. 0 of 7 and 6 of 7 are
 * the same kind of answer.
 *
 * Deliberately dependency-free (plain values in, plain values out) like lib/cardLayout.ts
 * and lib/growth.ts, so the store, the pure energy/growth helpers, the widget snapshot and
 * the cards can all share ONE rule without an import cycle. Do not import a store here —
 * pass what you need in.
 *
 * Connections:
 *   Imports → nothing (deliberate — see above)
 *   Used by → store/useTaskStore.ts, lib/energy.ts, lib/growth.ts, lib/widgets/sync.ts,
 *             lib/widgets/headlessSnapshot.ts, components/TaskCard.tsx,
 *             components/PlanTaskCard.tsx, app/plans.tsx, lib/aiSetupApply.ts,
 *             lib/__tests__/cardType.test.ts
 *   Data    → none (pure functions; the column is `tasks.card_type`, see lib/db.ts)
 */

/** How one to-do item draws itself. Stored in `tasks.card_type`. */
export type CardType = 'standard' | 'simple' | 'note' | 'stepped';

/** Every valid value, in the order the editor's picker offers them. */
export const CARD_TYPES: readonly CardType[] = ['standard', 'simple', 'note', 'stepped'] as const;

/** The default for every new item, and what every pre-existing row migrated to. */
export const DEFAULT_CARD_TYPE: CardType = 'standard';

/**
 * Coerce anything (a DB read, a synced peer's column, an AI-generated setup file) to a
 * valid CardType. Total by design: an unknown value falls back to 'standard' rather than
 * throwing, so a row written by a newer build still renders as an ordinary card here.
 */
export function sanitizeCardType(value: unknown): CardType {
  return CARD_TYPES.includes(value as CardType) ? (value as CardType) : DEFAULT_CARD_TYPE;
}

/**
 * Can this item be completed at all? Only a 'note' cannot.
 *
 * This is the ONE place the four types differ in something other than presentation, so
 * every count in the app asks here rather than re-deriving it: a note draws no check, is
 * excluded from remaining/finished counts, never reaches `lifetimeCompletedTasks`, never
 * fires the 'task_completed' automation, never counts as an active day for the growth
 * streak, and never contributes Energy.
 */
export function isCompletable(cardType: CardType): boolean {
  return cardType !== 'note';
}

/** The minimum a step has to carry for the helpers below (task_steps rows satisfy it). */
export type StepLike = { done: boolean; orderIndex: number };

/** Steps in their real order — lowest `orderIndex` first. Never mutates the input. */
export function orderedSteps<T extends StepLike>(steps: readonly T[]): T[] {
  return [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * Index (into `orderedSteps`) of the step a stepped card is currently showing: the first
 * not-done one. Returns `steps.length` when every step is done — one past the end, so a
 * caller can tell "finished" from "showing the last step" without a second flag.
 */
export function currentStepIndex(steps: readonly StepLike[]): number {
  const ordered = orderedSteps(steps);
  const next = ordered.findIndex((s) => !s.done);
  return next === -1 ? ordered.length : next;
}

/**
 * The 1-based number of the step a stepped card is SHOWING, or null once every step is done.
 *
 * This is what a one-step-at-a-time card labels itself with ("Step 1 of 2" while step one is
 * on screen), and it is deliberately not a done-count: a card displaying its first step and
 * labelled "Step 0 of 2" reads as a card that has failed to start. Partial progress is still
 * plainly legible — being on step 3 of 7 says two are behind you — which is the requirement,
 * without a zero state that looks like a shortfall.
 */
export function visibleStepNumber(steps: readonly StepLike[]): number | null {
  const index = currentStepIndex(steps);
  return index < steps.length ? index + 1 : null;
}

/** How far along a stepped card is. Just a pair of counts — see the header on why. */
export function steppedProgress(steps: readonly StepLike[]): { done: number; total: number } {
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/**
 * The share of an item's energy value that has actually been SPENT (0…1).
 *
 * Standard/simple cards are all-or-nothing on `done` — unchanged from before card types
 * existed. A **stepped** card spends proportionally, one step at a time, so a 6-step task
 * worth -3 has cost -1.5 by the time three steps are ticked instead of nothing until the
 * end. A **note** never spends anything, whatever its stored energy value says.
 *
 * A stepped card with no steps yet falls back to the all-or-nothing rule — there is no
 * denominator to divide by, and it is behaving like an ordinary card until steps exist.
 */
export function energySpentFraction(
  cardType: CardType,
  done: boolean,
  steps: readonly StepLike[]
): number {
  if (cardType === 'note') return 0;
  if (cardType === 'stepped' && steps.length > 0) {
    return steppedProgress(steps).done / steps.length;
  }
  return done ? 1 : 0;
}
