/**
 * useGrowth.ts — the store-reading wrapper around lib/growth.ts (2026-07-31).
 *
 * Keeps lib/growth.ts itself dependency-free (same split as lib/cardLayout.ts vs its
 * callers): all the Zustand/persistence lives here, all the arithmetic lives there.
 *
 * Returns the two numbers components/ScreenBackground.tsx draws with — `level` (how many
 * border branches have grown in) and `intensity` (how strong the positive tint is) — plus
 * nothing else. There is no count, no streak number and no points total exposed to any UI:
 * the maintainer's rule for this feature is that the user never sees a number.
 *
 * The high-water mark is persisted to settings.lifetimeGrowth (the reused `show_points`-era
 * `lifetime_bonsai_points` column — see store/useSettingsStore.ts). It KEEPS ACCUMULATING
 * while the feature is switched off, exactly as the Bonsai's points did, so turning it on
 * later reflects the streaks you actually built rather than starting from bare.
 *
 * Connections:
 *   Imports → lib/growth, lib/date (todayStr), store/useTaskStore, store/useHabitStore,
 *             store/useSettingsStore
 *   Used by → components/ScreenBackground.tsx
 *   Data    → reads tasks + habits + habit_logs; writes settings.lifetimeGrowth when the
 *             current streak beats the stored best
 *
 * Edit notes:
 *   - The scan is bounded (GROWTH_SCAN_DAYS) and memoised on the store arrays, so it only
 *     recomputes when a task/habit/log actually changes — but it DOES re-render
 *     ScreenBackground on those changes, which is why the returned intensity is quantised
 *     (see `QUANT`): a tick that moves the tint by less than one step must not repaint the
 *     backdrop. Keep any new return value quantised the same way.
 *   - `enabled` gates only the RETURNED visual values, never the persistence above.
 */
import { useEffect, useMemo } from 'react';
import { todayStr } from '@/lib/date';
import { growthState } from '@/lib/growth';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Intensity steps. The tint crossfades over seconds, so finer resolution than this is
 *  invisible and only costs backdrop repaints. */
const QUANT = 20;

export type Growth = {
  /** Border branches grown in (0 = the app's original three-corner art). */
  level: number;
  /** Positive tint strength [0, 1]; 0 is the normal neutral backdrop. */
  intensity: number;
};

export function useGrowth(): Growth {
  const tasks = useTaskStore((s) => s.tasks);
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const enabled = useSettingsStore((s) => s.showGrowth);
  const storedBest = useSettingsStore((s) => s.lifetimeGrowth);

  const today = todayStr();
  const state = useMemo(
    () => growthState(tasks, habits, logs, storedBest, today),
    [tasks, habits, logs, storedBest, today]
  );

  // Bank a new personal best. Runs at most once per improvement: after the write,
  // storedBest === best, so the effect's condition is false on the re-render.
  useEffect(() => {
    if (state.best > storedBest) {
      useSettingsStore.getState().update({ lifetimeGrowth: state.best });
    }
  }, [state.best, storedBest]);

  const intensity = Math.round(state.intensity * QUANT) / QUANT;

  return useMemo(
    () => (enabled ? { level: state.level, intensity } : { level: 0, intensity: 0 }),
    [enabled, state.level, intensity]
  );
}
