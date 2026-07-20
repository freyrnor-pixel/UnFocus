/**
 * useEnergyStore.ts — per-period Energy capacity overrides (optional Energy system).
 *
 * Owns the `energy_budgets` SQLite table: rows are ONLY the per-day / per-week
 * capacity OVERRIDES the user has explicitly set. When no override exists for a
 * period, the capacity falls back to the settings defaults
 * (energyDailyCapacity / energyWeeklyCapacity in store/useSettingsStore.ts).
 *
 * "Consumed"/gained energy is never stored here — it's derived from completed
 * tasks + met habits in lib/energy.ts. This store only answers "what is the
 * capacity for this period?" and lets the Home meter override it.
 *
 * Connections:
 *   Imports → lib/dataAccess, lib/energy (dayKey/weekKey), store/useSettingsStore
 *   Used by → components/EnergyMeter.tsx
 *   Data    → defines a Zustand store; owns the SQLite table energy_budgets
 *
 * Edit notes:
 *   - period_key is a day key 'YYYY-MM-DD' or a week key 'w:YYYY-MM-DD' (see lib/energy.ts).
 *   - setCapacity upserts (insert when the key is new, else update) and mirrors the row
 *     into the in-memory `overrides` map so reads stay synchronous.
 */
import { create } from 'zustand';
import {
  Row,
  FieldMap,
  loadAll,
  insertRow,
  updateRow,
  rowValues,
  readStr,
  readInt,
  logDbError,
} from '@/lib/dataAccess';
import { dayKey, weekKey } from '@/lib/energy';
import { useSettingsStore } from '@/store/useSettingsStore';

type Budget = { periodKey: string; capacity: number };

function rowToBudget(row: Row): Budget {
  return { periodKey: readStr(row, 'period_key'), capacity: readInt(row, 'capacity', 0) };
}

const BUDGET_COLUMNS: FieldMap<Budget> = {
  periodKey: { col: 'period_key' },
  capacity: { col: 'capacity' },
};

type EnergyStore = {
  /** period_key → capacity, only for user-set overrides. */
  overrides: Record<string, number>;
  loaded: boolean;
  load: () => void;
  /** Capacity for the day containing `date` — override if set, else the settings default. */
  capacityForDay: (date: string) => number;
  /** Capacity for the week containing `date` — override if set, else the settings default. */
  capacityForWeek: (date: string) => number;
  /** Set the day override for `date`. */
  setDayCapacity: (date: string, capacity: number) => void;
  /** Set the week override for the week containing `date`. */
  setWeekCapacity: (date: string, capacity: number) => void;
};

function persist(periodKey: string, capacity: number, hadOverride: boolean): void {
  try {
    const values = rowValues({ periodKey, capacity }, BUDGET_COLUMNS);
    if (hadOverride) updateRow('energy_budgets', { capacity }, 'period_key = ?', [periodKey]);
    else insertRow('energy_budgets', values);
  } catch (e) {
    logDbError(`useEnergyStore.setCapacity(${periodKey})`, e);
  }
}

export const useEnergyStore = create<EnergyStore>((set, get) => ({
  overrides: {},
  loaded: false,

  load() {
    const rows = loadAll('energy_budgets', rowToBudget);
    const overrides: Record<string, number> = {};
    for (const r of rows) overrides[r.periodKey] = r.capacity;
    set({ overrides, loaded: true });
  },

  capacityForDay(date) {
    const key = dayKey(date);
    const o = get().overrides[key];
    return o != null ? o : useSettingsStore.getState().energyDailyCapacity;
  },

  capacityForWeek(date) {
    const key = weekKey(date);
    const o = get().overrides[key];
    return o != null ? o : useSettingsStore.getState().energyWeeklyCapacity;
  },

  setDayCapacity(date, capacity) {
    const key = dayKey(date);
    set((s) => {
      persist(key, capacity, s.overrides[key] != null);
      return { overrides: { ...s.overrides, [key]: capacity } };
    });
  },

  setWeekCapacity(date, capacity) {
    const key = weekKey(date);
    set((s) => {
      persist(key, capacity, s.overrides[key] != null);
      return { overrides: { ...s.overrides, [key]: capacity } };
    });
  },
}));
