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
import { useCallback, useEffect, useMemo, useState } from 'react';
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

/**
 * ⚠️ **This does NOT subscribe to the task/habit stores through React (2026-09-14).**
 *
 * It used to read `s.tasks`, `s.habits` and `s.logs` as three whole arrays to produce two
 * numbers. Zustand hands back a new array identity on every write, so **every checkbox toggle
 * re-rendered `components/ScreenBackground.tsx`** — a tree of ten `<Svg>` elements with radial
 * gradients — and re-ran the bounded scan once per mounted instance (the pager holds one, and
 * every sub-tier screen mounts another). The previous pass quantised the RETURNED value so the
 * tint would not move; that fixed what was drawn and not what was rendered, and this file's own
 * edit notes said so.
 *
 * Now the stores are subscribed imperatively and `setState` is called only when a QUANTISED
 * value actually changes — which is rare. A task write still runs the scan, but it no longer
 * reaches React at all unless the backdrop would genuinely look different.
 *
 * ⚠️ Keep the equality check below exact. Returning a fresh object when the numbers are equal
 * puts the re-render straight back, and no test or harness in this repo can see that — it is a
 * performance property, not a pixel one.
 */
export function useGrowth(): Growth {
  const enabled = useSettingsStore((s) => s.showGrowth);
  const storedBest = useSettingsStore((s) => s.lifetimeGrowth);

  const compute = useCallback((): { level: number; intensity: number; best: number } => {
    const t = useTaskStore.getState();
    const h = useHabitStore.getState();
    const st = growthState(t.tasks, h.habits, h.logs, storedBest, todayStr());
    return {
      level: st.level,
      intensity: Math.round(st.intensity * QUANT) / QUANT,
      best: st.best,
    };
  }, [storedBest]);

  const [raw, setRaw] = useState(compute);

  useEffect(() => {
    const sync = () => {
      const next = compute();
      // Identity is held unless a quantised number moved — this is the whole point of the file.
      setRaw((prev) =>
        prev.level === next.level && prev.intensity === next.intensity && prev.best === next.best
          ? prev
          : next,
      );
    };
    sync(); // `storedBest` changed, or first mount: re-derive before listening.
    const offTasks = useTaskStore.subscribe(sync);
    const offHabits = useHabitStore.subscribe(sync);
    return () => {
      offTasks();
      offHabits();
    };
  }, [compute]);

  // Bank a new personal best. Runs at most once per improvement: after the write,
  // storedBest === best, so the effect's condition is false on the re-render.
  useEffect(() => {
    if (raw.best > storedBest) {
      useSettingsStore.getState().update({ lifetimeGrowth: raw.best });
    }
  }, [raw.best, storedBest]);

  return useMemo(
    () => (enabled ? { level: raw.level, intensity: raw.intensity } : { level: 0, intensity: 0 }),
    [enabled, raw.level, raw.intensity]
  );
}
