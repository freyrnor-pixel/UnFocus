/**
 * useShoppingListStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal currentList() contract Phase 3b's ShoppingQuickAddSheet
 * needs, and exports the ShoppingList type ListSettingsSheet consumes for its
 * props, ahead of Phase 5's real shopping-list store. Never call in a mounted
 * app — throws to make accidental real usage fail loudly instead of silently
 * no-op'ing.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/ShoppingQuickAddSheet.tsx, components/ListSettingsSheet.tsx (type only)
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy ShoppingList exactly as
 *     declared here (Decision 015). If the real store's needs differ, fix the
 *     contract there and re-typecheck the consuming sheets.
 */
export type ShoppingList = {
  id: string;
  isRecurring: boolean;
  recurrenceIntervalWeeks?: number;
};

type ShoppingListStoreState = {
  currentList: (dateStr: string) => { id: string } | undefined;
};

export function useShoppingListStore<T>(selector: (s: ShoppingListStoreState) => T): T {
  return selector({
    currentList: () => {
      throw new Error('useShoppingListStore is a Phase 5 stub (Decision 015) — not implemented yet');
    },
  });
}
