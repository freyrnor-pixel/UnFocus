/**
 * useShoppingListStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal currentList() contract Phase 3b's ShoppingQuickAddSheet
 * needs, and exports the ShoppingList type ListSettingsSheet consumes for its
 * props, ahead of Phase 5's real shopping-list store. Every action throws to
 * make accidental real usage fail loudly instead of silently no-op'ing —
 * consumers must only call actions from user-triggered handlers, never
 * unconditionally on mount. Reading `lists` is always safe — returns [].
 *
 * Connections:
 *   Imports → —
 *   Used by → components/ShoppingQuickAddSheet.tsx, components/ListSettingsSheet.tsx (type only),
 *             components/WeekListCard.tsx (type only), components/SavedListsModal.tsx (type only),
 *             app/shopping.tsx (full surface)
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy ShoppingList exactly as
 *     declared here (Decision 015). If the real store's needs differ, fix the
 *     contract there and re-typecheck the consuming sheets.
 *   - **Session A2·2 extension (2026-07-02, expanded scope — see PROGRESS_LOG):** widened
 *     `ShoppingList` with name/locked/isTemplate/startDate/endDate (app/shopping.tsx's
 *     WeekListCard rows and SavedListsModal's template list can't render without them),
 *     and widened the store surface with `lists` state plus rename/toggleLocked/
 *     setRecurring/advanceRecurringLists/saveAsTemplate/instantiateTemplate/add/remove —
 *     mirrors the old app's useShoppingListStore.ts signatures 1:1 where a ported
 *     consumer reads them.
 *   - **app/shopping.tsx does not call advanceRecurringLists from a mount-time effect**
 *     (unlike the old app) — it throws until Phase 5, and a mount-time throw would crash
 *     the screen. Flagged as a Phase 5 follow-up in PROGRESS_LOG, not silently dropped.
 */
export type ShoppingList = {
  id: string;
  name: string;
  locked: boolean;
  isTemplate: boolean;
  isRecurring: boolean;
  recurrenceIntervalWeeks?: number;
  startDate: string;
  endDate: string;
};

type ShoppingListStoreState = {
  lists: ShoppingList[];
  currentList: (dateStr: string) => { id: string } | undefined;
  rename: (id: string, name: string) => void;
  toggleLocked: (id: string) => void;
  setRecurring: (id: string, isRecurring: boolean, intervalWeeks?: number) => void;
  advanceRecurringLists: (today: string) => void;
  saveAsTemplate: (id: string) => void;
  instantiateTemplate: (id: string, today: string) => string | undefined;
  add: (range: { startDate: string; endDate: string }) => void;
  remove: (id: string) => void;
};

function notImplemented(): never {
  throw new Error('useShoppingListStore is a Phase 5 stub (Decision 015) — not implemented yet');
}

export function useShoppingListStore<T>(selector: (s: ShoppingListStoreState) => T): T {
  return selector({
    lists: [],
    currentList: notImplemented,
    rename: notImplemented,
    toggleLocked: notImplemented,
    setRecurring: notImplemented,
    advanceRecurringLists: notImplemented,
    saveAsTemplate: notImplemented,
    instantiateTemplate: notImplemented,
    add: notImplemented,
    remove: notImplemented,
  });
}
