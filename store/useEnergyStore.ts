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
 * **Today-only boost** (2026-08-02): a third `energy_budgets` key shape, 'b:YYYY-MM-DD'
 * (lib/energy.ts's `boostKey`), holding extra energy ADDED on top of the day's base
 * capacity. `capacityForDay` returns base + boost. It is a separate ROW, not folded into the
 * day override, precisely so a good day's "+3" cannot silently redefine the user's usual
 * capacity — tomorrow still reads their normal number.
 *
 * **Per-day pause state** (2026-08-02): this store also mirrors lib/energyDayState.ts's
 * `app_meta` rows (has the pause sheet offered itself today, did the user pause the day, is
 * one card pinned). It lives here rather than in a fourth store because every consumer
 * already reads capacity from here in the same render pass.
 *
 * Connections:
 *   Imports → lib/dataAccess, lib/energy (dayKey/weekKey/boostKey), lib/date (dayOfWeekMon0),
 *             lib/energyDayState (readAllDayStates/writeDayState/DEFAULT_DAY_STATE),
 *             store/useSettingsStore
 *   Used by → components/EnergyMeter.tsx, lib/useEnergyPause.ts, app/_layout.tsx (load on
 *             boot), __tests__/useEnergyStore.test.ts
 *   Data    → defines a Zustand store; owns the SQLite table energy_budgets, and mirrors the
 *             `app_meta` rows keyed `energy:day:<date>` (owned by lib/energyDayState.ts)
 *
 * Edit notes:
 *   - period_key is a day key 'YYYY-MM-DD', a week key 'w:YYYY-MM-DD', or a boost key
 *     'b:YYYY-MM-DD' (see lib/energy.ts). All three share the one `overrides` map.
 *   - setCapacity upserts (insert when the key is new, else update) and mirrors the row
 *     into the in-memory `overrides` map so reads stay synchronous.
 *   - The boost is a DAY concept only: `capacityForWeek` deliberately ignores it, because a
 *     "just for today" adjustment that quietly raised the week's ceiling would be the same
 *     silent redefinition the separate row exists to prevent.
 *   - `dayState` is a plain map read like `overrides` — the mirror is hydrated once in
 *     `load()`. Keep it synchronous: it is called from a render pass (lib/useEnergyPause.ts).
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
import { boostKey, dayKey, weekKey } from '@/lib/energy';
import { dayOfWeekMon0 } from '@/lib/date';
import {
  DEFAULT_DAY_STATE,
  EnergyDayState,
  readAllDayStates,
  writeDayState,
} from '@/lib/energyDayState';
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
  /** period_key → capacity, only for user-set overrides (day, week and 'b:' boost rows). */
  overrides: Record<string, number>;
  /** date → the day's pause/pin state. Mirrors lib/energyDayState.ts's `app_meta` rows. */
  dayStates: Record<string, EnergyDayState>;
  loaded: boolean;
  load: () => void;
  /**
   * Capacity for the day containing `date` — (override if set, else the settings default)
   * PLUS any today-only boost. The two are separate rows on purpose; see the file header.
   */
  capacityForDay: (date: string) => number;
  /** Capacity for the week containing `date` — override if set, else the settings default. */
  capacityForWeek: (date: string) => number;
  /** Set the day override for `date`. */
  setDayCapacity: (date: string, capacity: number) => void;
  /** Set the week override for the week containing `date`. */
  setWeekCapacity: (date: string, capacity: number) => void;
  /** Extra energy added to `date` alone — 0 when the user has not added any. */
  boostForDay: (date: string) => number;
  /** Set (or clear, with 0) the today-only boost for `date`. Leaves the base override alone. */
  setDayBoost: (date: string, boost: number) => void;
  /** This day's pause/pin state, or DEFAULT_DAY_STATE when nothing has happened on it. */
  dayState: (date: string) => EnergyDayState;
  /** Remember that the pause sheet has offered itself today. */
  markAutoShown: (date: string) => void;
  /** "I'm good" — energy stays out of the way for the rest of `date`. */
  pauseDay: (date: string) => void;
  /** "I'll decide" — the one card the user chose. Replaces any previous pin. */
  pinTask: (date: string, taskId: string) => void;
  /** Drop the pin (a tap on the pin badge). Everything else about the day is untouched. */
  unpinTask: (date: string) => void;
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

/**
 * Apply a patch to one day's pause state: write it through to `app_meta` and mirror it into
 * the in-memory map, so the next `dayState(date)` read stays a synchronous lookup.
 */
function patchDayState(
  set: (fn: (s: EnergyStore) => Partial<EnergyStore>) => void,
  date: string,
  patch: Partial<EnergyDayState>
): void {
  set((s) => {
    const next = { ...(s.dayStates[date] ?? DEFAULT_DAY_STATE), ...patch };
    writeDayState(date, next);
    return { dayStates: { ...s.dayStates, [date]: next } };
  });
}

export const useEnergyStore = create<EnergyStore>((set, get) => ({
  overrides: {},
  dayStates: {},
  loaded: false,

  load() {
    const rows = loadAll('energy_budgets', rowToBudget);
    const overrides: Record<string, number> = {};
    for (const r of rows) overrides[r.periodKey] = r.capacity;
    set({ overrides, dayStates: readAllDayStates(), loaded: true });
  },

  capacityForDay(date) {
    const key = dayKey(date);
    const o = get().overrides[key];
    const base = o != null ? o : defaultDayCapacity(date);
    return base + get().boostForDay(date);
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

  boostForDay(date) {
    const b = get().overrides[boostKey(date)];
    return b != null ? b : 0;
  },

  setDayBoost(date, boost) {
    const key = boostKey(date);
    set((s) => {
      persist(key, boost, s.overrides[key] != null);
      return { overrides: { ...s.overrides, [key]: boost } };
    });
  },

  dayState(date) {
    return get().dayStates[date] ?? DEFAULT_DAY_STATE;
  },

  markAutoShown(date) {
    patchDayState(set, date, { autoShown: true });
  },

  pauseDay(date) {
    // Stamping `autoShown` alongside `paused` means a day the user has closed out never
    // re-offers the sheet, even if they never saw it open (backdrop tap / Android back both
    // run this path).
    patchDayState(set, date, { paused: true, autoShown: true });
  },

  pinTask(date, taskId) {
    patchDayState(set, date, { pinnedTaskId: taskId, autoShown: true });
  },

  unpinTask(date) {
    // Only the pin goes. `paused`/`autoShown` are about the day, not about this one card —
    // un-pinning must not re-open the sheet the user has already answered.
    patchDayState(set, date, { pinnedTaskId: null });
  },
}));
