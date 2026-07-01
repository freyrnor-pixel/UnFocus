/**
 * useShoppingStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal add() contract Phase 3b's ShoppingQuickAddSheet needs,
 * and exports the ShoppingItem type UpdateSheet and Phase 3c's MonthlyTableRow
 * consume for their props, ahead of Phase 5's real shopping store. Never call
 * in a mounted app — throws to make accidental real usage fail loudly instead
 * of silently no-op'ing.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/ShoppingQuickAddSheet.tsx, components/UpdateSheet.tsx (type only), components/MonthlyTableRow.tsx (type only)
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy ShoppingItemInput/ShoppingItem
 *     exactly as declared here (Decision 015). If the real store's needs differ,
 *     fix the contract there and re-typecheck the consuming sheets.
 *   - pendingRestock added for MonthlyTableRow (Phase 3c) — the old app's field
 *     flagging an item into the weekly staging tray, independent of `status`.
 */
export type ShoppingItem = {
  id: string;
  name: string;
  price: number;
  targetQuantity: number;
  isTemporary: boolean;
  pendingRestock: boolean;
};

export type ShoppingItemInput = {
  name: string;
  amount: string;
  unit: string;
  listType: string;
  store: string;
  price: number;
  inventoryQty: number;
  status: string;
  listId?: string;
};

type ShoppingStoreState = {
  add: (item: ShoppingItemInput) => void;
};

export function useShoppingStore<T>(selector: (s: ShoppingStoreState) => T): T {
  return selector({
    add: () => {
      throw new Error('useShoppingStore is a Phase 5 stub (Decision 015) — not implemented yet');
    },
  });
}
