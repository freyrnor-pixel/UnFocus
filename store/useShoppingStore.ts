/**
 * useShoppingStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal add() contract Phase 3b's ShoppingQuickAddSheet needs,
 * and exports the ShoppingItem type UpdateSheet, MonthlyTableRow, and
 * ShoppingRow consume for their props, ahead of Phase 5's real shopping
 * store. Never call in a mounted app — throws to make accidental real usage
 * fail loudly instead of silently no-op'ing.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/ShoppingQuickAddSheet.tsx, components/UpdateSheet.tsx (type only),
 *             components/MonthlyTableRow.tsx (type only), components/ShoppingRow.tsx (type only —
 *             the row itself takes callback props, not these actions directly; Session A2·2's
 *             shopping screen is the actual caller of toggleCheck/toggleCollected/adjustAmount/
 *             putBackToInventory/removeWithSource/reorder)
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy ShoppingItemInput/ShoppingItem
 *     exactly as declared here (Decision 015). If the real store's needs differ,
 *     fix the contract there and re-typecheck the consuming sheets.
 *   - pendingRestock added for MonthlyTableRow (Phase 3c) — the old app's field
 *     flagging an item into the weekly staging tray, independent of `status`.
 *   - amount/unit/checked/collected/fromCatalog/inventoryQty added for Session A2·1's
 *     ShoppingRow (Phase 3c, 2026-07-02) — the row can't render its two-line layout,
 *     variant states, or catalog-vs-ad-hoc remove branch without them. Same minimal-
 *     contract precedent as every other Decision 015 stub: only what a ported
 *     consumer actually reads, not the old app's full ShoppingItem shape (which also
 *     has category/monthlyAllocated/dishName/status/purchasedAt/weekKey/shoppingTripId/
 *     listId/orderIndex — none of those are read by any ported component yet).
 *   - toggleCheck/toggleCollected/adjustAmount/putBackToInventory/removeWithSource/reorder
 *     added as typed-only action stubs for the same reason — ShoppingRow doesn't call
 *     them itself (it only fires onToggle/onCollect/onRemove/onIncrement/onDecrement
 *     callbacks, dumb-row pattern like NoteRow/MonthlyTableRow), but Session A2·2's
 *     shopping screen will, so the contract needs to exist now rather than mid-screen-session.
 *     Signatures mirror the old app's useShoppingStore.ts 1:1 (including reorder's
 *     'up'/'down' direction shape — Phase 5 may revisit this once real drag persistence
 *     is wired, but this stub doesn't decide that).
 */
export type ShoppingItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  price: number;
  targetQuantity: number;
  isTemporary: boolean;
  pendingRestock: boolean;
  checked: boolean;
  collected: boolean;
  fromCatalog: boolean;
  inventoryQty: number;
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
  toggleCheck: (id: string) => void;
  toggleCollected: (id: string) => void;
  adjustAmount: (id: string, delta: number) => void;
  putBackToInventory: (id: string) => void;
  removeWithSource: (id: string) => void;
  reorder: (id: string, direction: 'up' | 'down') => void;
};

function notImplemented(): never {
  throw new Error('useShoppingStore is a Phase 5 stub (Decision 015) — not implemented yet');
}

export function useShoppingStore<T>(selector: (s: ShoppingStoreState) => T): T {
  return selector({
    add: notImplemented,
    toggleCheck: notImplemented,
    toggleCollected: notImplemented,
    adjustAmount: notImplemented,
    putBackToInventory: notImplemented,
    removeWithSource: notImplemented,
    reorder: notImplemented,
  });
}
