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
 * The DEFAULT (no override) capacity depends on settings.energyMode (2026-07-24):
 * 'daily'/'weekly' use the flat energyDailyCapacity/energyWeeklyCapacity; 'custom'
 * uses settings.energyCustomCapacities (Mon..Sun per-weekday amounts, set in
 * app/settings.tsx) — capacityForDay picks that weekday's entry, capacityForWeek
 * sums all seven. See defaultDayCapacity/defaultWeekCapacity below.
 *
 * Connections:
 *   Imports → lib/dataAccess, lib/energy (dayKey/weekKey), lib/date (dayOfWeekMon0),
 *             store/useSettingsStore
 *   Used by → components/EnergyMeter.tsx, __tests__/useEnergyStore.test.ts
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
import { dayOfWeekMon0 } from '@/lib/date';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Default capacity for the day containing `date`, honouring energyMode (2026-07-24):
 *  'custom' picks that weekday's amount from energyCustomCapacities, otherwise the
 *  flat energyDailyCapacity. */
function defaultDayCapacity(date: string): number {
  const settings = useSettingsStore.getState();
  if (settings.energyMode === 'custom') {
    return settings.energyCustomCapacities[dayOfWeekMon0(new Date(date + 'T12:00:00'))] ?? 0;
  }
  return settings.energyDailyCapacity;
}

/** Default capacity for the Mon–Sun week containing `date`, honouring energyMode —
 *  'custom' sums the seven per-weekday amounts, otherwise the flat energyWeeklyCapacity. */
function defaultWeekCapacity(): number {
  const settings = useSettingsStore.getState();
  if (settings.energyMode === 'custom') {
    return settings.energyCustomCapacities.reduce((sum, n) => sum + n, 0);
  }
  return settings.energyWeeklyCapacity;
}

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
    return o != null ? o : defaultDayCapacity(date);
  },

  capacityForWeek(date) {
    const key = weekKey(date);
    const o = get().overrides[key];
    return o != null ? o : defaultWeekCapacity();
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
