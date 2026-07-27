/**
 * taskStarters.ts — structural data for the one-tap example task offered on the
 * empty Plans/To-do StarterCard ("Rydde"/"Tidy up" — a daily, time-boxed cleaning
 * routine with steps, chosen to actually demonstrate recurrence + time-boxing +
 * steps, the three things the plans starter text talks about).
 *
 * Mirrors lib/habitStarters.ts's split: this file holds only the STRUCTURAL half
 * (time box + step order); the user-facing title/step titles live in lib/i18n.ts
 * under `starters.plans.exampleTitle` / `starters.plans.exampleSteps.<key>` so both
 * languages stay in sync by key rather than by array position.
 *
 * Connections:
 *   Imports → none
 *   Used by → app/(tabs)/plans.tsx (empty-state example row's "+" add button)
 *   Data    → none directly; a tap in plans.tsx feeds this into useTaskStore's
 *             add()/addStep()
 *
 * Edit notes:
 *   - Keys are load-bearing: each one needs a matching title in BOTH the `en` and
 *     `no` `starters.plans.exampleSteps` objects (`no: typeof en` makes tsc enforce
 *     this).
 */
export type PlanStarterStepKey = 'trash' | 'tidy' | 'table' | 'dishwasher' | 'laundry';

/** Order the steps are created in — mirrors the order in lib/i18n.ts's exampleSteps. */
export const PLAN_STARTER_STEPS: readonly PlanStarterStepKey[] = ['trash', 'tidy', 'table', 'dishwasher', 'laundry'];

export const PLAN_STARTER_TIME = '17:00';
export const PLAN_STARTER_FINISH_TIME = '17:20';
