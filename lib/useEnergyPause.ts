/**
 * useEnergyPause.ts — the one hook every surface asks about today's energy pause (2026-08-02).
 *
 * Home's card, the meter's overspend control, the pause sheet and the Plans tab all need the
 * same four answers — is today over budget, has the user paused it, is one card pinned, and
 * which cards would "I'll decide" offer — so they read them from here rather than each
 * re-deriving them from three stores and getting subtly different results.
 *
 * **Rewards mode is DISABLED, not hidden.** When `settings.energySystemEnabled` is false the
 * hook reports `enabled: false` and a frozen inert object: no over-budget state, no
 * candidates, and no energy arithmetic anywhere. Every selector below short-circuits on that
 * flag before it touches a task, a habit or a budget, so nothing about energy is computed on
 * a phone that has opted out of it.
 *
 * The one thing that is NOT a literal early return is the return statement itself, and that
 * is deliberate: bailing before the remaining `useSelector` calls would change the hook COUNT
 * between renders the moment the user switches modes with a screen mounted, which React
 * treats as a crash ("rendered fewer hooks than expected"). Guarding each selector's *body*
 * gets the same guarantee — nothing energy-shaped is read or summed — while keeping the hook
 * order fixed. Don't "simplify" it back to an early return.
 *
 * **Nothing here notifies, at any horizon.** Being over budget is a state, not an alert.
 * lib/__tests__/energyPause.test.ts source-scans this file (plus lib/energyPause.ts and
 * lib/energyDayState.ts) for notification APIs and asserts zero hits.
 *
 * Connections:
 *   Imports → lib/date (todayStr), lib/energy (energyDeltaForDay, plannedEnergyDeltaForDay),
 *             lib/energyPause (isOverBudget, decideCandidates),
 *             store/useSettingsStore, store/useTaskStore, store/useHabitStore,
 *             store/useEnergyStore
 *   Used by → components/EnergyMeter.tsx (the meter, the overspend control and both
 *             pause-sheet triggers), components/TaskCard.tsx + components/PlanTaskCard.tsx
 *             (the pin badge's unpin action), app/plans.tsx (the Today lift).
 *             NOT app/(tabs)/index.tsx — Home draws its day card through PlanTaskCard,
 *             which reads this hook itself, so Home needed no change at all.
 *   Data    → reads only; every write goes through store/useEnergyStore.ts's day-state
 *             actions, which persist to the device-local `app_meta` row (never synced)
 *
 * Edit notes:
 *   - `current` and `plannedOver` are computed with the SAME expressions
 *     components/EnergyMeter.tsx uses for its day row, so the control and the number beside
 *     it can never disagree. If one changes, change both.
 *   - `shouldAutoShow` is a suggestion, not a trigger: the caller still decides whether the
 *     screen is calm enough to open a sheet (focused, nothing else mounted). It stays true
 *     until `markShown()` is called, so a backgrounded app re-offers rather than silently
 *     burning the day's one chance — the `lastMonthlyReset` precedent.
 *   - Today is resolved once per render via `todayStr()`. A device left open across midnight
 *     picks the new day up on its next render, which also resets the pause — intended.
 */
import { useCallback, useMemo } from 'react';
import { todayStr } from '@/lib/date';
import { energyDeltaForDay, plannedEnergyDeltaForDay } from '@/lib/energy';
import { decideCandidates, isOverBudget } from '@/lib/energyPause';
import { DEFAULT_DAY_STATE } from '@/lib/energyDayState';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore, Task } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useEnergyStore } from '@/store/useEnergyStore';

export type EnergyPause = {
  /** False in Rewards mode — the caller should render no energy UI at all. */
  enabled: boolean;
  /** Spent or planned energy has passed today's capacity (lib/energyPause.ts). */
  overBudget: boolean;
  /** The user said "I'm good" — energy stays out of the way for the rest of today. */
  paused: boolean;
  /** The one card "I'll decide" settled on, or null. */
  pinnedTaskId: string | null;
  /** Up to four of today's cards, cheapest first — what "I'll decide" offers. */
  candidates: Task[];
  /** Over budget, not paused, and today has not offered the sheet yet. */
  shouldAutoShow: boolean;
  /** Stamp today as having offered the sheet. Call on acknowledgement, not on open. */
  markShown: () => void;
  /** "I'm good". */
  pause: () => void;
  /** "I'll decide" — pin one card. */
  pin: (taskId: string) => void;
  /** Drop the pin. */
  unpin: () => void;
};

const NO_TASKS: Task[] = [];
const NO_HABITS: never[] = [];
const NOOP = () => {};

/**
 * What every consumer gets in Rewards mode. Frozen so a caller that reaches for a setter
 * fails loudly in development rather than quietly writing to a shared object.
 */
const INERT: EnergyPause = Object.freeze({
  enabled: false,
  overBudget: false,
  paused: false,
  pinnedTaskId: null,
  candidates: NO_TASKS,
  shouldAutoShow: false,
  markShown: NOOP,
  pause: NOOP,
  pin: NOOP as (taskId: string) => void,
  unpin: NOOP,
});

export function useEnergyPause(): EnergyPause {
  const enabled = useSettingsStore((s) => s.energySystemEnabled);
  const today = todayStr();

  // Rewards mode short-circuits inside each selector — see the header on why this is not a
  // literal early return. `enabled` is false ⇒ nothing below reads or sums energy data.
  const tasks = useTaskStore((s) => (enabled ? s.tasks : NO_TASKS));
  const habits = useHabitStore((s) => (enabled ? s.habits : NO_HABITS));
  const habitLogs = useHabitStore((s) => (enabled ? s.logs : NO_HABITS));
  const capacity = useEnergyStore((s) => (enabled ? s.capacityForDay(today) : 0));
  // Subscribing to the raw row keeps the selector's identity stable (a missing day is
  // `undefined`, not a fresh object), so this never loops on itself.
  const storedDayState = useEnergyStore((s) => (enabled ? s.dayStates[today] : undefined));

  const markAutoShown = useEnergyStore((s) => s.markAutoShown);
  const pauseDay = useEnergyStore((s) => s.pauseDay);
  const pinTaskAction = useEnergyStore((s) => s.pinTask);
  const unpinTaskAction = useEnergyStore((s) => s.unpinTask);

  const markShown = useCallback(() => markAutoShown(today), [markAutoShown, today]);
  const pause = useCallback(() => pauseDay(today), [pauseDay, today]);
  const pin = useCallback((taskId: string) => pinTaskAction(today, taskId), [pinTaskAction, today]);
  const unpin = useCallback(() => unpinTaskAction(today), [unpinTaskAction, today]);

  return useMemo(() => {
    if (!enabled) return INERT;

    const dayState = storedDayState ?? DEFAULT_DAY_STATE;
    // Same two expressions as components/EnergyMeter.tsx's day row (see edit notes).
    const current = capacity + energyDeltaForDay(today, tasks, habits, habitLogs);
    const plannedOver = -Math.min(0, capacity + plannedEnergyDeltaForDay(today, tasks, habits));
    const overBudget = isOverBudget(current, plannedOver);

    return {
      enabled: true,
      overBudget,
      paused: dayState.paused,
      pinnedTaskId: dayState.pinnedTaskId,
      candidates: decideCandidates(tasks, today),
      shouldAutoShow: overBudget && !dayState.paused && !dayState.autoShown,
      markShown,
      pause,
      pin,
      unpin,
    };
  }, [enabled, today, tasks, habits, habitLogs, capacity, storedDayState, markShown, pause, pin, unpin]);
}
