/**
 * useMonthlyListStore.ts — multiple, named, independently-budgeted Monthly ("Katalog") lists.
 *
 * Shopping — Monthly redesign (2026-07-22): the Monthly tab used to be one single global
 * Katalog card with one global budget. This store owns `monthly_lists` rows — each a
 * named list with its own `budgetNok` and its own `lastReset` (drives lib/budget.ts's
 * computeSpendPace() per list, same shape as the old single global monthlyBudgetNok/
 * lastMonthlyReset settings). Each list's items are `shopping_items` rows whose
 * `monthlyListId` matches — see store/useShoppingStore.ts's header for how that column
 * travels with a row through the catalog→inWeeklyList→purchased pipeline. Mirrors
 * store/useShoppingListStore.ts (weekly) in shape, minus the date/recurrence/template
 * concepts weekly lists need and Monthly lists don't.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id
 *   Used by → app/(tabs)/shopping.tsx (Monthly tab), app/budget.tsx (per-list budget editor),
 *             app/(tabs)/scan.tsx (receipt monthly-list tagging picker, type only)
 *   Data    → defines a Zustand store; owns SQLite table monthly_lists
 *
 * Edit notes:
 *   - `remove(id)` does NOT cascade-delete that list's shopping_items — it only deletes the
 *     monthly_lists row, leaving orphaned rows with a stale monthlyListId (never surfaced
 *     again, since no card renders for that id). Deliberately mirrors
 *     useShoppingListStore.remove()'s identical non-cascading behavior for weekly lists.
 *   - `lastReset` starts '' (never reset) for a brand-new list, same as the old global
 *     lastMonthlyReset — computeSpendPace() returns null (no pace line shown) until a
 *     reset actually happens. stampAllReset() is called by the payday-boundary automatic
 *     reset (app/(tabs)/shopping.tsx's finalizeMonthlyReset) to stamp every list at once;
 *     a single list's own manual reset icon stamps just that one list via update().
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import {
  Row,
  FieldMap,
  loadAll,
  insertRow,
  updateRow,
  rowValues,
  readStr,
  readReal,
  readInt,
  readBool,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';

export type MonthlyList = {
  id: string;
  name: string;
  budgetNok: number;
  locked: boolean;
  sortOrder: number;
  /** YYYY-MM-DD of this list's last reset (auto or manual); '' = never reset. */
  lastReset: string;
  createdAt: string;
};

type MonthlyListAddInput = {
  name?: string;
  sortOrder?: number;
};

type MonthlyListStore = {
  lists: MonthlyList[];
  load: () => void;
  add: (input: MonthlyListAddInput) => string;
  update: (id: string, patch: Partial<Omit<MonthlyList, 'id'>>) => void;
  rename: (id: string, name: string) => void;
  setBudget: (id: string, budgetNok: number) => void;
  toggleLocked: (id: string) => void;
  remove: (id: string) => void;
  /** Stamps every list's lastReset = today — the payday-boundary automatic reset resets
   *  all Monthly lists at once, since a payday is one household-wide event. */
  stampAllReset: (today: string) => void;
};

function rowToList(row: Row): MonthlyList {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    budgetNok: readReal(row, 'budget_nok'),
    locked: readBool(row, 'locked'),
    sortOrder: readInt(row, 'sort_order'),
    lastReset: readStr(row, 'last_reset'),
    createdAt: readStr(row, 'created_at'),
  };
}

const LIST_COLUMNS: FieldMap<MonthlyList> = {
  id: { col: 'id' },
  name: { col: 'name' },
  budgetNok: { col: 'budget_nok' },
  locked: { col: 'locked', to: (v) => (v ? 1 : 0) },
  sortOrder: { col: 'sort_order' },
  lastReset: { col: 'last_reset' },
  createdAt: { col: 'created_at' },
};

export const useMonthlyListStore = create<MonthlyListStore>((set, get) => ({
  lists: [],

  load() {
    set({ lists: loadAll('monthly_lists', rowToList, { orderBy: 'sort_order' }) });
  },

  add(input) {
    const id = generateId();
    const list: MonthlyList = {
      id,
      name: input.name?.trim() ?? '',
      budgetNok: 0,
      locked: false,
      sortOrder: input.sortOrder ?? get().lists.length,
      lastReset: '',
      createdAt: new Date().toISOString(),
    };
    insertRow('monthly_lists', rowValues(list, LIST_COLUMNS));
    set((s) => ({ lists: [...s.lists, list] }));
    return id;
  },

  update(id, patch) {
    const list = get().lists.find((l) => l.id === id);
    if (!list) return;
    const next = { ...list, ...patch };
    updateRow('monthly_lists', rowValues(patch, LIST_COLUMNS), 'id = ?', [id]);
    set((s) => ({ lists: s.lists.map((l) => (l.id === id ? next : l)) }));
  },

  rename(id, name) {
    get().update(id, { name });
  },

  setBudget(id, budgetNok) {
    get().update(id, { budgetNok: Math.max(0, budgetNok) });
  },

  toggleLocked(id) {
    const list = get().lists.find((l) => l.id === id);
    if (!list) return;
    get().update(id, { locked: !list.locked });
  },

  remove(id) {
    db.runSync('DELETE FROM monthly_lists WHERE id = ?', [id]);
    set((s) => ({ lists: s.lists.filter((l) => l.id !== id) }));
  },

  stampAllReset(today) {
    db.runSync('UPDATE monthly_lists SET last_reset = ?', [today]);
    set((s) => ({ lists: s.lists.map((l) => ({ ...l, lastReset: today })) }));
  },
}));
