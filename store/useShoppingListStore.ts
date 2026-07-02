/**
 * useShoppingListStore.ts — multiple, named, recurring weekly shopping lists.
 *
 * Owns `shopping_lists` rows: dated "Ukeliste" periods (default name auto-computed
 * from settings.weeklyResetDay, e.g. "May 19-25"), optionally recurring every 1-4
 * weeks, or saved as a dateless template. Each list's items are `shopping_items`
 * rows with status='inWeeklyList' and a matching list_id — the Katalog
 * (status='catalog') is untouched and never carries a list_id.
 *
 * Phase 5 real port (2026-07-02) — replaces the Decision 015 typed-only stub.
 * Ports the old app's store logic verbatim; the exported `ShoppingList` widens
 * the stub's shape (adds isCustomName/sortOrder/createdAt, makes
 * recurrenceIntervalWeeks required) — additive for every consumer, all of which
 * only READ lists as a prop type (none construct a ShoppingList literal). The
 * stub's `add(range)` / `currentList → {id}` signatures are subsumed by the real
 * `add(ShoppingListAddInput) → string` / `currentList → ShoppingList | undefined`,
 * so no consumer churns.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/date, lib/i18n, store/useSettingsStore
 *   Used by → app/shopping.tsx, components/WeekListCard.tsx (type), components/ListSettingsSheet.tsx (type),
 *             components/SavedListsModal.tsx (type)
 *   Data    → defines a Zustand store; owns SQLite table shopping_lists; also writes
 *             shopping_items rows directly (list_id backfill + recurrence/template item copies)
 *
 * Edit notes:
 *   - currentList(today) only ever returns a non-template list — templates are
 *     excluded by construction, so their items (same status='inWeeklyList' shape,
 *     just parented to a template's list_id) never leak into the active weekly view.
 *   - advanceRecurringLists()/saveAsTemplate()/instantiateTemplate() never mutate an
 *     old list's rows in place — they always insert a fresh list + fresh item rows
 *     (new ids), leaving the old list and its items as untouched history.
 *   - advanceRecurringLists() computes the new period directly from
 *     recurrenceIntervalWeeks (closed-form, not an incremental week-by-week loop),
 *     so an app left unopened for months jumps straight to the current period
 *     instead of generating one list per skipped cycle.
 *   - load()'s backfill assigns a bootstrap list to any pre-migration inWeeklyList
 *     item that still has list_id IS NULL — runs once, self-healing like
 *     useShoppingStore's mergeDuplicateItems().
 *   - Calling code must refresh useShoppingStore's `items` (re-run its load()) after
 *     advanceRecurringLists()/instantiateTemplate(), since those write shopping_items
 *     rows directly via this store rather than through useShoppingStore. app/shopping.tsx
 *     does exactly this in its on-focus effect.
 *   - `locked` is the padlock state for this list's card in app/shopping.tsx — gates
 *     add/remove/edit only, never the checkmark. Every constructor of a ShoppingList
 *     (add/advanceRecurringLists/saveAsTemplate/instantiateTemplate/backfillOrphanedItems)
 *     defaults it to false (unlocked) so a freshly created list is immediately editable.
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
  readInt,
  readBool,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { dateStr, todayStr, getWeekRangeContaining, formatDateRange } from '@/lib/date';
import { getTranslations } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';

export type ShoppingList = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isRecurring: boolean;
  /** 1-4 weeks; also the list's own span in weeks (a "2 weeks" list covers 14 days). */
  recurrenceIntervalWeeks: number;
  /** Freezes auto-rename once the user has edited the name. */
  isCustomName: boolean;
  /** Saved-for-later list, accessed via the "saved lists" popup — never the active list. */
  isTemplate: boolean;
  /** Padlock state for this list's card — locked gates add/remove/edit (not the checkmark). */
  locked: boolean;
  sortOrder: number;
  createdAt: string;
};

type ShoppingListAddInput = {
  name?: string;
  startDate: string;
  endDate: string;
  isRecurring?: boolean;
  recurrenceIntervalWeeks?: number;
  isCustomName?: boolean;
  isTemplate?: boolean;
  sortOrder?: number;
};

type ShoppingListStore = {
  lists: ShoppingList[];
  load: () => void;
  add: (input: ShoppingListAddInput) => string;
  update: (id: string, patch: Partial<Omit<ShoppingList, 'id'>>) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  setRecurring: (id: string, isRecurring: boolean, intervalWeeks?: number) => void;
  toggleLocked: (id: string) => void;
  /** The active (non-template) list whose [startDate, endDate] contains `today`. */
  currentList: (today: string) => ShoppingList | undefined;
  /** Rolls every overdue recurring list forward to the period containing `today`. */
  advanceRecurringLists: (today: string) => void;
  saveAsTemplate: (id: string) => void;
  /** Creates a live list from a template, dated to the current week. Returns the new list's id. */
  instantiateTemplate: (id: string, today: string) => string | undefined;
};

function rowToList(row: Row): ShoppingList {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    startDate: readStr(row, 'start_date'),
    endDate: readStr(row, 'end_date'),
    isRecurring: readBool(row, 'is_recurring'),
    recurrenceIntervalWeeks: readInt(row, 'recurrence_interval_weeks', 1),
    isCustomName: readBool(row, 'is_custom_name'),
    isTemplate: readBool(row, 'is_template'),
    locked: readBool(row, 'locked'),
    sortOrder: readInt(row, 'sort_order'),
    createdAt: readStr(row, 'created_at'),
  };
}

const LIST_COLUMNS: FieldMap<ShoppingList> = {
  id: { col: 'id' },
  name: { col: 'name' },
  startDate: { col: 'start_date' },
  endDate: { col: 'end_date' },
  isRecurring: { col: 'is_recurring', to: (v) => (v ? 1 : 0) },
  recurrenceIntervalWeeks: { col: 'recurrence_interval_weeks' },
  isCustomName: { col: 'is_custom_name', to: (v) => (v ? 1 : 0) },
  isTemplate: { col: 'is_template', to: (v) => (v ? 1 : 0) },
  locked: { col: 'locked', to: (v) => (v ? 1 : 0) },
  sortOrder: { col: 'sort_order' },
  createdAt: { col: 'created_at' },
};

/** Auto-computed list name from its date span, in the user's current language. */
function defaultListName(startDate: string, endDate: string): string {
  const lang = useSettingsStore.getState().language;
  const t = getTranslations(lang);
  return formatDateRange(startDate, endDate, t.monthsShort, lang);
}

/**
 * Copies a list's still-open (status='inWeeklyList') items into another list as
 * fresh, unchecked rows (new ids; checked/collected/purchasedAt/tripId reset).
 * The source rows are left untouched — they remain that list's history.
 */
function copyOpenItemsToList(sourceListId: string, targetListId: string): void {
  const openItemIds = db.getAllSync<{ id: string }>(
    "SELECT id FROM shopping_items WHERE list_id = ? AND status = 'inWeeklyList'",
    [sourceListId]
  );
  for (const { id: sourceItemId } of openItemIds) {
    db.runSync(
      `INSERT INTO shopping_items (
        id, name, amount, unit, list_type, checked, store, price, category,
        monthly_allocated, monthly_source_id, inventory_qty, dish_name, status,
        is_temporary, purchased_at, week_key, pending_restock, target_quantity,
        shopping_trip_id, collected, from_catalog, list_id, order_index
      )
      SELECT
        ?, name, amount, unit, list_type, 0, store, price, category,
        monthly_allocated, monthly_source_id, inventory_qty, dish_name, status,
        is_temporary, NULL, week_key, pending_restock, target_quantity,
        NULL, 0, from_catalog, ?, order_index
      FROM shopping_items WHERE id = ?`,
      [generateId(), targetListId, sourceItemId]
    );
  }
}

/** One-time bootstrap: any pre-migration inWeeklyList item with no list_id gets a fresh current-week list. */
function backfillOrphanedItems(lists: ShoppingList[]): ShoppingList[] {
  const orphaned = db.getFirstSync<{ c: number }>(
    "SELECT COUNT(*) as c FROM shopping_items WHERE status = 'inWeeklyList' AND list_id IS NULL"
  );
  if (!orphaned || orphaned.c === 0) return lists;

  const today = todayStr();
  const weeklyResetDay = useSettingsStore.getState().weeklyResetDay;
  const { startDate, endDate } = getWeekRangeContaining(today, weeklyResetDay);
  const id = generateId();
  const list: ShoppingList = {
    id,
    name: defaultListName(startDate, endDate),
    startDate,
    endDate,
    isRecurring: false,
    recurrenceIntervalWeeks: 1,
    isCustomName: false,
    isTemplate: false,
    locked: false,
    sortOrder: lists.length,
    createdAt: new Date().toISOString(),
  };
  insertRow('shopping_lists', rowValues(list, LIST_COLUMNS));
  db.runSync("UPDATE shopping_items SET list_id = ? WHERE status = 'inWeeklyList' AND list_id IS NULL", [id]);
  return [...lists, list];
}

export const useShoppingListStore = create<ShoppingListStore>((set, get) => ({
  lists: [],

  load() {
    const lists = loadAll('shopping_lists', rowToList, { orderBy: 'start_date' });
    set({ lists: backfillOrphanedItems(lists) });
  },

  add(input) {
    const id = generateId();
    const list: ShoppingList = {
      id,
      name: input.name?.trim() || defaultListName(input.startDate, input.endDate),
      startDate: input.startDate,
      endDate: input.endDate,
      isRecurring: input.isRecurring ?? false,
      recurrenceIntervalWeeks: input.recurrenceIntervalWeeks ?? 1,
      isCustomName: input.isCustomName ?? !!input.name,
      isTemplate: input.isTemplate ?? false,
      locked: false,
      sortOrder: input.sortOrder ?? get().lists.length,
      createdAt: new Date().toISOString(),
    };
    insertRow('shopping_lists', rowValues(list, LIST_COLUMNS));
    set((s) => ({ lists: [...s.lists, list] }));
    return id;
  },

  update(id, patch) {
    const list = get().lists.find((l) => l.id === id);
    if (!list) return;
    const next = { ...list, ...patch };
    updateRow('shopping_lists', rowValues(patch, LIST_COLUMNS), 'id = ?', [id]);
    set((s) => ({ lists: s.lists.map((l) => (l.id === id ? next : l)) }));
  },

  remove(id) {
    db.runSync('DELETE FROM shopping_lists WHERE id = ?', [id]);
    set((s) => ({ lists: s.lists.filter((l) => l.id !== id) }));
  },

  rename(id, name) {
    get().update(id, { name, isCustomName: true });
  },

  setRecurring(id, isRecurring, intervalWeeks) {
    const list = get().lists.find((l) => l.id === id);
    if (!list) return;
    get().update(id, {
      isRecurring,
      recurrenceIntervalWeeks: intervalWeeks ?? list.recurrenceIntervalWeeks,
    });
  },

  toggleLocked(id) {
    const list = get().lists.find((l) => l.id === id);
    if (!list) return;
    get().update(id, { locked: !list.locked });
  },

  currentList(today) {
    const active = get().lists.filter((l) => !l.isTemplate);
    const inRange = active.find((l) => l.startDate <= today && today <= l.endDate);
    if (inRange) return inRange;
    return [...active].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  },

  advanceRecurringLists(today) {
    const overdue = get().lists.filter((l) => l.isRecurring && !l.isTemplate && l.endDate < today);
    if (overdue.length === 0) return;

    for (const old of overdue) {
      const intervalDays = old.recurrenceIntervalWeeks * 7;
      const start = new Date(old.startDate + 'T12:00:00');
      const end = new Date(today + 'T12:00:00');
      const daysSince = Math.round((end.getTime() - start.getTime()) / 86400000);
      const periodsElapsed = Math.floor(daysSince / intervalDays);
      const newStart = new Date(start);
      newStart.setDate(start.getDate() + periodsElapsed * intervalDays);
      const newEnd = new Date(newStart);
      newEnd.setDate(newStart.getDate() + 6);
      const startDate = dateStr(newStart);
      const endDate = dateStr(newEnd);

      const id = generateId();
      const newList: ShoppingList = {
        id,
        name: old.isCustomName ? old.name : defaultListName(startDate, endDate),
        startDate,
        endDate,
        isRecurring: true,
        recurrenceIntervalWeeks: old.recurrenceIntervalWeeks,
        isCustomName: old.isCustomName,
        isTemplate: false,
        locked: false,
        sortOrder: old.sortOrder,
        createdAt: new Date().toISOString(),
      };
      insertRow('shopping_lists', rowValues(newList, LIST_COLUMNS));
      copyOpenItemsToList(old.id, id);
      set((s) => ({ lists: [...s.lists, newList] }));
    }
  },

  saveAsTemplate(id) {
    const list = get().lists.find((l) => l.id === id);
    if (!list) return;
    const templateId = generateId();
    const template: ShoppingList = {
      ...list,
      id: templateId,
      isTemplate: true,
      isRecurring: false,
      isCustomName: true,
      locked: false,
      createdAt: new Date().toISOString(),
    };
    insertRow('shopping_lists', rowValues(template, LIST_COLUMNS));
    copyOpenItemsToList(list.id, templateId);
    set((s) => ({ lists: [...s.lists, template] }));
  },

  instantiateTemplate(id, today) {
    const template = get().lists.find((l) => l.id === id && l.isTemplate);
    if (!template) return undefined;
    const weeklyResetDay = useSettingsStore.getState().weeklyResetDay;
    const { startDate, endDate } = getWeekRangeContaining(today, weeklyResetDay);
    const newId = generateId();
    const newList: ShoppingList = {
      id: newId,
      name: template.isCustomName ? template.name : defaultListName(startDate, endDate),
      startDate,
      endDate,
      isRecurring: false,
      recurrenceIntervalWeeks: 1,
      isCustomName: template.isCustomName,
      isTemplate: false,
      locked: false,
      sortOrder: get().lists.filter((l) => !l.isTemplate).length,
      createdAt: new Date().toISOString(),
    };
    insertRow('shopping_lists', rowValues(newList, LIST_COLUMNS));
    copyOpenItemsToList(template.id, newId);
    set((s) => ({ lists: [...s.lists, newList] }));
    return newId;
  },
}));
