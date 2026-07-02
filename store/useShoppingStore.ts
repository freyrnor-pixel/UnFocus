/**
 * useShoppingStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal add() contract Phase 3b's ShoppingQuickAddSheet needs,
 * and exports the ShoppingItem type UpdateSheet, MonthlyTableRow, and
 * ShoppingRow consume for their props, ahead of Phase 5's real shopping
 * store. Every action throws to make accidental real usage fail loudly
 * instead of silently no-op'ing — consumers must only call actions from
 * user-triggered handlers (onPress etc.), never unconditionally on mount,
 * or the screen will crash before Phase 5 lands. Reading state (items/trips)
 * is always safe — it just returns empty arrays.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/ShoppingQuickAddSheet.tsx, components/UpdateSheet.tsx (type only),
 *             components/MonthlyTableRow.tsx (type only), components/ShoppingRow.tsx (type only),
 *             components/SharedRequestsSection.tsx (add only), components/WeekListCard.tsx (type only),
 *             components/MonthlyResetSummaryModal.tsx (MonthlyResetSummary type),
 *             lib/shoppingGroups.ts (type only), app/shopping.tsx (full surface)
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy ShoppingItemInput/ShoppingItem
 *     exactly as declared here (Decision 015). If the real store's needs differ,
 *     fix the contract there and re-typecheck the consuming sheets.
 *   - pendingRestock added for MonthlyTableRow (Phase 3c) — the old app's field
 *     flagging an item into the weekly staging tray, independent of `status`.
 *   - amount/unit/checked/collected/fromCatalog/inventoryQty added for Session A2·1's
 *     ShoppingRow (Phase 3c, 2026-07-02).
 *   - toggleCheck/toggleCollected/adjustAmount/putBackToInventory/removeWithSource/reorder
 *     added as typed-only action stubs for the same reason as above (Session A2·1).
 *   - **Session A2·2 extension (2026-07-02, expanded scope — see PROGRESS_LOG):** widened
 *     to the full old-app ShoppingItem/store surface so app/shopping.tsx (and the newly
 *     ported WeekListCard/SharedRequestsSection/MonthlyResetSummaryModal it composes)
 *     can typecheck. Added fields: dishName?, orderIndex?, listId?, status, purchasedAt?,
 *     shoppingTripId? — the last three power the Monthly-tab purchase history and
 *     computeListGroups()'s weekly filtering, none of which Session A2·1's row alone
 *     needed. Added state: items, trips. Added actions: update, addToWeeklyFromCatalog,
 *     setPendingRestock, confirmStagingTray, doneShopping, monthlyReset,
 *     buildMonthlyResetSummary, load. Added `getState()` (Zustand-shape) since the old
 *     screen calls `useShoppingStore.getState().load()` outside a component (after
 *     useShoppingListStore.advanceRecurringLists/instantiateTemplate write rows this
 *     store doesn't know about yet) — Phase 5 must implement it the same way. Same
 *     minimal-contract precedent as every other Decision 015 stub — mirrors the old
 *     app's useShoppingStore.ts signatures where a ported consumer reads them;
 *     `category` (old app field) dropped since nothing in this repo reads it yet.
 *   - **app/shopping.tsx deliberately does NOT call any action below from a mount-time
 *     effect** (unlike the old app's advanceRecurringLists/load()/automatic monthly-reset
 *     detection) — every one of them throws until Phase 5, and a mount-time throw would
 *     crash the whole screen. Only user-triggered handlers (onPress) call them, same
 *     accepted-safe pattern as AddItemSheet/UpdateSheet's existing buttons. The automatic
 *     recurring-list-advance and payday-boundary monthly-reset effects are flagged as a
 *     Phase 5 follow-up in PROGRESS_LOG, not silently dropped.
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
  /** Optional "From meals" dish-group name — shared by Monthly catalog and Week lists. */
  dishName?: string;
  /** Manual sort position within its list's ungrouped-unchecked bucket (drag reorder). */
  orderIndex?: number;
  /** Which Week list this row belongs to (status === 'inWeeklyList' rows only). */
  listId?: string;
  /** 'catalog' | 'inWeeklyList' | 'purchased' — the row's lifecycle stage. */
  status: string;
  /** ISO datetime stamped by doneShopping(); only set once status === 'purchased'. */
  purchasedAt?: string;
  /** Which shopping_trips row this purchase belongs to (status === 'purchased' rows only). */
  shoppingTripId?: string;
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
  isTemporary?: boolean;
  targetQuantity?: number;
  dishName?: string;
};

export type ShoppingTrip = {
  id: string;
  label: string;
};

export type MonthlyResetSummary = {
  inventorySpent: number;
  inventoryTotalValue: number;
  inventoryItems: ShoppingItem[];
  adHocItems: ShoppingItem[];
};

type ShoppingStoreState = {
  items: ShoppingItem[];
  trips: ShoppingTrip[];
  add: (item: ShoppingItemInput) => void;
  update: (id: string, patch: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) => void;
  toggleCheck: (id: string) => void;
  toggleCollected: (id: string) => void;
  adjustAmount: (id: string, delta: number) => void;
  putBackToInventory: (id: string) => void;
  removeWithSource: (id: string) => void;
  reorder: (id: string, direction: 'up' | 'down') => void;
  addToWeeklyFromCatalog: (id: string, quantity: number, listId: string) => void;
  setPendingRestock: (id: string, pending: boolean) => void;
  confirmStagingTray: () => void;
  doneShopping: (listId: string, tripLabel: string, monthlyResetDate: number) => void;
  monthlyReset: () => void;
  buildMonthlyResetSummary: () => MonthlyResetSummary;
  load: () => void;
};

function notImplemented(): never {
  throw new Error('useShoppingStore is a Phase 5 stub (Decision 015) — not implemented yet');
}

const state: ShoppingStoreState = {
  items: [],
  trips: [],
  add: notImplemented,
  update: notImplemented,
  toggleCheck: notImplemented,
  toggleCollected: notImplemented,
  adjustAmount: notImplemented,
  putBackToInventory: notImplemented,
  removeWithSource: notImplemented,
  reorder: notImplemented,
  addToWeeklyFromCatalog: notImplemented,
  setPendingRestock: notImplemented,
  confirmStagingTray: notImplemented,
  doneShopping: notImplemented,
  monthlyReset: notImplemented,
  buildMonthlyResetSummary: notImplemented,
  load: notImplemented,
};

type ShoppingStoreHook = {
  <T>(selector: (s: ShoppingStoreState) => T): T;
  getState: () => ShoppingStoreState;
};

function useShoppingStoreImpl<T>(selector: (s: ShoppingStoreState) => T): T {
  return selector(state);
}
useShoppingStoreImpl.getState = () => state;

export const useShoppingStore: ShoppingStoreHook = useShoppingStoreImpl;
