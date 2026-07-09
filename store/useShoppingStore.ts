/**
 * useShoppingStore.ts — Katalog (permanent inventory) + Ukeliste (weekly working list)
 *
 * Zustand store for shopping items, all living in the single `shopping_items`
 * table, driven by a single `status` pipeline:
 *   'catalog' -> 'inWeeklyList' -> 'purchased'
 * ('staged' and `pendingRestock` are both vestigial — Decision 044a removed the
 * Monthly tab's staging tray; addToWeeklyFromCatalog now runs immediately from the
 * Monthly checkbox, no separate confirm step.) Katalog is the permanent household
 * inventory; doneShopping marks weekly items 'purchased' and records a
 * shopping_trips row; monthlyReset reverts non-temporary items to 'catalog' and
 * purges trips + temporary rows.
 *
 * Phase 5 real port (2026-07-02) — replaces the Decision 015 typed-only stub.
 * The port keeps the old app's logic but reconciles its EXPORTED shape to the
 * stub contract every already-ported consumer (app/shopping.tsx + 8 components)
 * compiles against, so no consumer churns:
 *   - `MonthlyResetSummary.inventoryItems/adHocItems` are `ShoppingItem[]` (the
 *     purchased rows themselves), matching MonthlyResetSummaryModal — the old
 *     app's projected `MonthlyResetSummaryItem[]`/`generatedAt` shape is dropped.
 *   - `update()` keeps the broad `Partial<Omit<ShoppingItem,'id'>>` signature the
 *     store's own internals need; the stub's narrow patch is a subset, so callers
 *     passing `{name,price,targetQuantity,isTemporary}` still typecheck.
 *   - Old-only columns (listType/store/monthlyAllocated/monthlySourceId/weekKey)
 *     stay on ShoppingItem as optional/legacy fields — additive, breaks nobody.
 *
 * Decisions applied by this port:
 *   - Decision 021 — re-add increments (both paths). addToWeeklyFromCatalog no
 *     longer OVERWRITES amount; if a matching inWeeklyList row already exists in
 *     the target list it increments that row instead (leaving the standing
 *     catalog row intact), matching add()'s increment semantics.
 *   - Decision 022 — mergeItems(sourceId, targetId): sums the two rows' amounts
 *     into the target (the dish row), adopts the target's dishName/group, and
 *     deletes the source. New Phase-5 store action; the same-name gate + drag
 *     wiring is the future shopping-row drag session's Phase-6 concern, not here.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/liveSync, lib/syncService, store/useSettingsStore
 *   Used by → app/inventory-edit.tsx, app/shopping.tsx, components/ShoppingQuickAddSheet.tsx,
 *             components/AddItemSheet.tsx (type), components/AddDishSheet.tsx (add), components/UpdateSheet.tsx (type),
 *             components/MonthlyTableRow.tsx (type), components/ShoppingRow.tsx (type), components/WeekListCard.tsx (type),
 *             components/SharedRequestsSection.tsx (add), components/MonthlyResetSummaryModal.tsx (MonthlyResetSummary),
 *             lib/shoppingGroups.ts (type); app/shopping.tsx hydrates via load() in its on-focus effect (Phase 5 — no global bootstrap yet)
 *   Data    → defines a Zustand store; owns SQLite tables shopping_items + shopping_trips
 *
 * Edit notes:
 *   - **LAN live-sync wiring (Decision 038, app integration) — WIRED, narrow scope.**
 *     `add`/`update` (the sole write path for toggleCheck/toggleCollected/adjustAmount/
 *     putBackToInventory/addToWeeklyFromCatalog/setPendingRestock — everything routes
 *     through `update()`) stamp + broadcast via lib/liveSync/lib/syncService.
 *     `remove`/`removeWithSource` soft-delete (tombstone) instead of a hard DELETE.
 *     `load()` filters `deleted_at IS NULL`. Only the columns in lib/liveSync's
 *     shopping_items whitelist (name/amount/unit/list_type/checked/store/price/
 *     created_at/list_id) actually cross the wire — `status` and the rest of the
 *     catalog/purchase-trip state machine are NOT synced fields, so doneShopping/
 *     monthlyReset's raw-SQL bulk transitions are deliberately left untouched (they
 *     bypass update() and don't write whitelisted columns anyway).
 *     mergeDuplicateItems' one-time self-heal DELETE is also left as a hard delete —
 *     it repairs pre-existing accidental dupes, not a user delete action.
 *   - add() consolidates duplicates: same status+listId+name+dishName bumps the
 *     existing row's targetQuantity (catalog) or amount (weekly) instead of
 *     inserting — never assume add() creates a fresh row.
 *   - collected = "checked off while in the cart" (distinct from checked = "moved
 *     to cart"). fromCatalog = row originated from the standing Katalog; it drives
 *     buildMonthlyResetSummary()'s inventory-vs-ad-hoc split — call it BEFORE
 *     monthlyReset(), which clears the purchasedAt/shoppingTripId it reads.
 *   - putBackToInventory(id) reverts ANY row to status='catalog' (clearing
 *     checked/collected/pendingRestock) — used when removing a fromCatalog row
 *     from the weekly list, since that row IS the user's permanent Katalog entry.
 *   - listId/orderIndex let multiple inWeeklyList items coexist across dated lists;
 *     doneShopping(listId,...) and add()'s dedup both scope by listId. Items never
 *     carry listId once status='catalog'. reorder(id,dir) swaps orderIndex with
 *     the adjacent same-listId item.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - isTemporary purges on monthly reset; permanent catalog items are never
 *     deleted by reset, only their status/pendingRestock move.
 *   - **Decision 044b — `recentlyAddedIds`**: ephemeral (non-persisted, non-synced) map of
 *     ids added or moved-to-weekly in the last 1.8s, set by `markRecentlyAdded()` and
 *     self-clearing via `setTimeout`. `add()` and `addToWeeklyFromCatalog()` call it on
 *     every insert/dedup-increment. Consumed by components/ShoppingRow.tsx (entrance +
 *     highlight animation) and app/(tabs)/shopping.tsx (Weekly tab cross-tab cue) — both
 *     read it rather than owning their own "just added" state, so the cue survives a tab
 *     switch and Food tab's direct `add()` calls (UNALLOCATED_LIST_ID rows) are covered
 *     for free without FoodTab needing to know about it.
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
import { touchRow, softDelete } from '@/lib/liveSync';
import { broadcastRow } from '@/lib/syncService';
import { useSettingsStore } from '@/store/useSettingsStore';

export type ShoppingStatus = 'catalog' | 'staged' /* vestigial: never written by new code; kept for old row compatibility */ | 'inWeeklyList' | 'purchased';

/**
 * Sentinel list_id for the weekly "Unallocated" bucket. Rows with status='inWeeklyList'
 * and this list_id are dish ingredients the user added to "the week" from the Food tab
 * before assigning them to a specific dated week list. It is a real (non-null) id so
 * useShoppingListStore.backfillOrphanedItems() (which only claims list_id IS NULL rows)
 * never sweeps it into a dated list, and no shopping_lists row exists for it — the
 * Shopping screen renders it as its own card. Allocating an item moves it to a real list_id.
 */
export const UNALLOCATED_LIST_ID = '__unallocated__';

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
  /** 'catalog' | 'staged' | 'inWeeklyList' | 'purchased' — the row's lifecycle stage. */
  status: ShoppingStatus;
  /** ISO datetime stamped by doneShopping(); only set once status === 'purchased'. */
  purchasedAt?: string;
  /** Which shopping_trips row this purchase belongs to (status === 'purchased' rows only). */
  shoppingTripId?: string;
  /** Catalog category slug, used for catalog grouping/autocomplete. */
  category?: string;
  // --- Legacy columns kept for backward read/write compatibility (additive; new code paths don't rely on them). ---
  /** Vestigial weekly/monthly split — the status pipeline supersedes it, but the column still exists. */
  listType?: 'weekly' | 'monthly';
  store?: string;
  monthlyAllocated?: number;
  monthlySourceId?: string;
  weekKey?: string;
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
  completedAt: string;
  monthResetDate: number;
  /** The shopping_lists row this trip's purchases came from. */
  listId?: string;
};

export type MonthlyResetSummary = {
  inventorySpent: number;
  inventoryTotalValue: number;
  inventoryItems: ShoppingItem[];
  adHocItems: ShoppingItem[];
};

/** Decision 044b — how long a row stays flagged "just added" for entrance/highlight motion. */
const RECENT_ADD_MS = 1800;

type ShoppingStore = {
  items: ShoppingItem[];
  trips: ShoppingTrip[];
  /** Decision 044b — ids added/moved-to-weekly within the last RECENT_ADD_MS, for
   *  ShoppingRow's entrance+highlight animation and the Weekly tab's cross-tab cue.
   *  Ephemeral UI state only — never persisted, never synced. */
  recentlyAddedIds: Record<string, boolean>;
  markRecentlyAdded: (id: string) => void;
  load: () => void;
  add: (item: ShoppingItemInput) => string;
  update: (id: string, patch: Partial<Omit<ShoppingItem, 'id'>>) => void;
  toggleCheck: (id: string) => void;
  toggleCollected: (id: string) => void;
  adjustAmount: (id: string, delta: number) => void;
  putBackToInventory: (id: string) => void;
  remove: (id: string) => void;
  removeWithSource: (id: string) => void;
  /** Swaps orderIndex with the adjacent item sharing the same listId (mirrors useHabitStore.reorder). */
  reorder: (id: string, direction: 'up' | 'down') => void;
  /** Decision 022 — merge the source row into the target (dish) row: sum amounts, adopt target group, delete source. */
  mergeItems: (sourceId: string, targetId: string) => void;
  addToWeeklyFromCatalog: (id: string, quantity?: number, listId?: string) => void;
  setPendingRestock: (id: string, pending: boolean) => void;
  doneShopping: (listId: string, label: string, monthResetDate: number) => string;
  monthlyReset: () => void;
  buildMonthlyResetSummary: () => MonthlyResetSummary;
};

function rowToItem(row: Row): ShoppingItem {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    amount: readStr(row, 'amount') || '1',
    unit: readStr(row, 'unit'),
    listType: (readStr(row, 'list_type', 'weekly') as 'weekly' | 'monthly'),
    checked: readBool(row, 'checked'),
    store: readStr(row, 'store'),
    price: readReal(row, 'price'),
    category: readStr(row, 'category') || 'other',
    monthlyAllocated: readReal(row, 'monthly_allocated'),
    monthlySourceId: readStr(row, 'monthly_source_id') || undefined,
    inventoryQty: readReal(row, 'inventory_qty'),
    dishName: readStr(row, 'dish_name') || undefined,
    status: (readStr(row, 'status') || 'catalog') as ShoppingStatus,
    isTemporary: readBool(row, 'is_temporary'),
    purchasedAt: readStr(row, 'purchased_at') || undefined,
    weekKey: readStr(row, 'week_key') || undefined,
    pendingRestock: readBool(row, 'pending_restock'),
    targetQuantity: readInt(row, 'target_quantity', 1),
    shoppingTripId: readStr(row, 'shopping_trip_id') || undefined,
    collected: readBool(row, 'collected'),
    fromCatalog: readBool(row, 'from_catalog'),
    listId: readStr(row, 'list_id') || undefined,
    orderIndex: readInt(row, 'order_index'),
  };
}

function rowToTrip(row: Row): ShoppingTrip {
  return {
    id: readStr(row, 'id'),
    completedAt: readStr(row, 'completed_at'),
    label: readStr(row, 'label'),
    monthResetDate: readInt(row, 'month_reset_date', 1),
    listId: readStr(row, 'list_id') || undefined,
  };
}

/** Field → column mapping for shopping items (serialisers preserve the old INSERT/UPDATE nulls/booleans). */
const ITEM_COLUMNS: FieldMap<ShoppingItem> = {
  id: { col: 'id' },
  name: { col: 'name' },
  amount: { col: 'amount' },
  unit: { col: 'unit' },
  listType: { col: 'list_type', to: (v) => v ?? 'weekly' },
  checked: { col: 'checked', to: (v) => (v ? 1 : 0) },
  store: { col: 'store', to: (v) => v ?? '' },
  price: { col: 'price' },
  category: { col: 'category', to: (v) => v ?? 'other' },
  monthlyAllocated: { col: 'monthly_allocated', to: (v) => v ?? 0 },
  monthlySourceId: { col: 'monthly_source_id', to: (v) => v ?? null },
  inventoryQty: { col: 'inventory_qty', to: (v) => v ?? 0 },
  dishName: { col: 'dish_name', to: (v) => v ?? null },
  status: { col: 'status' },
  isTemporary: { col: 'is_temporary', to: (v) => (v ? 1 : 0) },
  purchasedAt: { col: 'purchased_at', to: (v) => v ?? null },
  weekKey: { col: 'week_key', to: (v) => v ?? null },
  pendingRestock: { col: 'pending_restock', to: (v) => (v ? 1 : 0) },
  targetQuantity: { col: 'target_quantity', to: (v) => v ?? 1 },
  shoppingTripId: { col: 'shopping_trip_id', to: (v) => v ?? null },
  collected: { col: 'collected', to: (v) => (v ? 1 : 0) },
  fromCatalog: { col: 'from_catalog', to: (v) => (v ? 1 : 0) },
  listId: { col: 'list_id', to: (v) => v ?? null },
  orderIndex: { col: 'order_index', to: (v) => v ?? 0 },
};

/**
 * One-time self-healing pass: merges rows that share status+name+dishName (the
 * same key add()'s dedup safeguard checks) into a single row, summing amount
 * (weekly/cart/purchased rows) or targetQuantity (catalog rows) and deleting the
 * extras. Needed because that safeguard only stops *new* duplicates — rows
 * created before it existed can still be sitting in the DB.
 */
function mergeDuplicateItems(items: ShoppingItem[]): ShoppingItem[] {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const key = `${item.status}|${item.name.trim().toLowerCase()}|${item.dishName ?? ''}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const result: ShoppingItem[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    try {
      const [keep, ...dupes] = [...group].sort((a, b) => a.id.localeCompare(b.id));
      let amount = parseInt(keep.amount, 10) || 1;
      let targetQuantity = keep.targetQuantity;
      let price = keep.price;
      for (const dupe of dupes) {
        if (keep.status === 'catalog') {
          targetQuantity += dupe.targetQuantity;
        } else {
          amount += parseInt(dupe.amount, 10) || 1;
        }
        if (dupe.price > 0) price = dupe.price;
        db.runSync('DELETE FROM shopping_items WHERE id = ?', [dupe.id]);
      }
      const merged: ShoppingItem = { ...keep, amount: String(amount), targetQuantity, price };
      updateRow('shopping_items', rowValues(merged, ITEM_COLUMNS), 'id = ?', [keep.id]);
      result.push(merged);
    } catch {
      // Merge failed (e.g. mid-write error) — keep the rows as-is rather than losing data.
      result.push(...group);
    }
  }
  return result;
}

/** Stamp + broadcast a local mutation (Decision 038b/038 wiring) — call after every write. */
function syncItemRow(id: string): void {
  touchRow('shopping_items', id, useSettingsStore.getState().deviceId);
  broadcastRow('shopping_items', id);
}

export const useShoppingStore = create<ShoppingStore>((set, get) => ({
  items: [],
  trips: [],
  recentlyAddedIds: {},

  markRecentlyAdded(id) {
    set((s) => ({ recentlyAddedIds: { ...s.recentlyAddedIds, [id]: true } }));
    setTimeout(() => {
      set((s) => {
        if (!s.recentlyAddedIds[id]) return s;
        const next = { ...s.recentlyAddedIds };
        delete next[id];
        return { recentlyAddedIds: next };
      });
    }, RECENT_ADD_MS);
  },

  load() {
    const items = loadAll('shopping_items', rowToItem, { orderBy: 'status, name', where: 'deleted_at IS NULL' });
    set({
      items: mergeDuplicateItems(items),
      trips: loadAll('shopping_trips', rowToTrip, { orderBy: 'completed_at DESC' }),
    });
  },

  add(item) {
    const status = (item.status || 'catalog') as ShoppingStatus;
    const targetQuantity = item.targetQuantity ?? 1;

    // Consolidate with an existing row of the same status/name/dish instead of
    // creating a duplicate row — same item added twice becomes one row with an
    // incremented amount (weekly/inventory-add) or target quantity (catalog-add).
    const trimmedName = item.name.trim();
    const existing = get().items.find(
      (i) =>
        i.status === status &&
        i.listId === item.listId &&
        i.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (i.dishName ?? undefined) === (item.dishName ?? undefined)
    );
    if (existing) {
      const patch: Partial<Omit<ShoppingItem, 'id'>> =
        status === 'catalog'
          ? { targetQuantity: existing.targetQuantity + targetQuantity }
          : { amount: String((parseInt(existing.amount, 10) || 1) + (parseInt(item.amount, 10) || 1)) };
      if (item.price > 0) patch.price = item.price;
      get().update(existing.id, patch);
      get().markRecentlyAdded(existing.id);
      return existing.id;
    }

    const id = generateId();
    const isTemporary = item.isTemporary ?? false;
    const fromCatalog = status === 'catalog';
    const orderIndex = get().items.filter((i) => i.listId === item.listId).length;
    const newItem: ShoppingItem = {
      id,
      name: trimmedName,
      amount: item.amount,
      unit: item.unit,
      listType: (item.listType as 'weekly' | 'monthly') || 'weekly',
      store: item.store,
      price: item.price,
      category: 'other',
      monthlyAllocated: 0,
      monthlySourceId: undefined,
      inventoryQty: item.inventoryQty ?? 0,
      dishName: item.dishName,
      status,
      isTemporary,
      purchasedAt: undefined,
      weekKey: undefined,
      pendingRestock: false,
      targetQuantity,
      shoppingTripId: undefined,
      checked: false,
      collected: false,
      fromCatalog,
      listId: item.listId,
      orderIndex,
    };
    insertRow('shopping_items', rowValues(newItem, ITEM_COLUMNS));
    set((s) => ({ items: [...s.items, newItem] }));
    syncItemRow(id);
    get().markRecentlyAdded(id);
    return id;
  },

  update(id, patch) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const next = { ...item, ...patch };
    updateRow('shopping_items', rowValues(patch, ITEM_COLUMNS), 'id = ?', [id]);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? next : i)) }));
    syncItemRow(id);
  },

  toggleCheck(id) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const patch: Partial<Omit<ShoppingItem, 'id'>> = { checked: !item.checked };
    // When unchecking a collected cart item, clear collected too so it
    // doesn't silently re-enter the cart in a pre-collected state.
    if (item.checked && item.collected) patch.collected = false;
    get().update(id, patch);
  },

  toggleCollected(id) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    get().update(id, { collected: !item.collected });
  },

  adjustAmount(id, delta) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const current = parseInt(item.amount, 10) || 1;
    const next = Math.max(0, current + delta);
    if (next === 0) {
      get().removeWithSource(id);
    } else {
      get().update(id, { amount: String(next) });
    }
  },

  putBackToInventory(id) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    get().update(id, { status: 'catalog', checked: false, collected: false, pendingRestock: false });
  },

  remove(id) {
    // Soft-delete (Decision 038b tombstone), not a hard DELETE: a synced row must
    // stay long enough to tell a peer it's gone, or a stale peer copy would undo
    // the delete on next sync. pruneOldData() doesn't currently prune shopping_items
    // by date (config-like lifecycle), so tombstones persist until re-added/reset.
    softDelete('shopping_items', id, useSettingsStore.getState().deviceId);
    broadcastRow('shopping_items', id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  removeWithSource(id) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;

    if (item.monthlySourceId) {
      const qty = parseInt(item.amount, 10) || 1;
      try {
        db.runSync(
          'UPDATE shopping_items SET monthly_allocated = MAX(0, monthly_allocated - ?) WHERE id = ?',
          [qty, item.monthlySourceId]
        );
      } catch { /* ignore */ }
      set((s) => ({
        items: s.items.map((i) =>
          i.id === item.monthlySourceId
            ? { ...i, monthlyAllocated: Math.max(0, (i.monthlyAllocated ?? 0) - qty) }
            : i
        ),
      }));
    }

    // Soft-delete (Decision 038b tombstone) — see remove()'s comment.
    softDelete('shopping_items', id, useSettingsStore.getState().deviceId);
    broadcastRow('shopping_items', id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  reorder(id, direction) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const sameList = get().items
      .filter((i) => i.listId === item.listId)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const idx = sameList.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameList.length) return;
    const a = sameList[idx];
    const b = sameList[swapIdx];
    const aOrder = a.orderIndex ?? 0;
    const bOrder = b.orderIndex ?? 0;
    updateRow('shopping_items', { order_index: bOrder }, 'id = ?', [a.id]);
    updateRow('shopping_items', { order_index: aOrder }, 'id = ?', [b.id]);
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id === a.id) return { ...i, orderIndex: bOrder };
        if (i.id === b.id) return { ...i, orderIndex: aOrder };
        return i;
      }),
    }));
  },

  /**
   * Decision 022 — merge two rows drag-dropped onto each other. Sums the source
   * row's amount into the target (dish) row and deletes the source. The target
   * keeps its own dishName/group membership, so the merged row "joins the dish".
   * The same-name gate and the drag hit-testing are the caller's concern (the
   * future shopping-row drag session); this action just performs the merge.
   */
  mergeItems(sourceId, targetId) {
    if (sourceId === targetId) return;
    const source = get().items.find((i) => i.id === sourceId);
    const target = get().items.find((i) => i.id === targetId);
    if (!source || !target) return;
    const summed = String((parseInt(target.amount, 10) || 1) + (parseInt(source.amount, 10) || 1));
    get().update(target.id, { amount: summed });
    get().remove(source.id);
  },

  /** "+" menu's "From inventory" — flips a catalog row into the weekly list.
   *  Decision 021: if a matching weekly row already exists in this list, increment
   *  it instead of flipping (which would overwrite the amount / duplicate the row);
   *  the standing catalog row is left intact. */
  addToWeeklyFromCatalog(id, quantity = 1, listId) {
    const item = get().items.find((i) => i.id === id && i.status === 'catalog');
    if (!item) return;
    const qty = Math.max(1, quantity);
    const existingWeekly = get().items.find(
      (i) =>
        i.status === 'inWeeklyList' &&
        i.listId === listId &&
        i.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
        (i.dishName ?? undefined) === (item.dishName ?? undefined)
    );
    if (existingWeekly) {
      get().update(existingWeekly.id, {
        amount: String((parseInt(existingWeekly.amount, 10) || 1) + qty),
      });
      get().markRecentlyAdded(existingWeekly.id);
      return;
    }
    get().update(id, { status: 'inWeeklyList', pendingRestock: false, amount: String(qty), listId });
    get().markRecentlyAdded(id);
  },

  /** Vestigial (Decision 044a) — inventory-edit.tsx's standalone Katalog screen still
   *  calls this for its checkbox; the Monthly tab no longer does (it calls
   *  addToWeeklyFromCatalog directly). Kept for that one caller; no UI reads the flag. */
  setPendingRestock(id, pending) {
    get().update(id, { pendingRestock: pending });
  },

  /** "Handlingen fullført" — creates a shopping_trips row and marks every inWeeklyList item in `listId` purchased. */
  doneShopping(listId, label, monthResetDate) {
    const tripId = generateId();
    const now = new Date().toISOString();
    insertRow('shopping_trips', {
      id: tripId,
      completed_at: now,
      label,
      month_reset_date: monthResetDate,
      list_id: listId,
    });
    db.runSync(
      "UPDATE shopping_items SET status = 'purchased', purchased_at = ?, shopping_trip_id = ?, checked = 0, collected = 0 WHERE status = 'inWeeklyList' AND list_id = ?",
      [now, tripId, listId]
    );
    const trip: ShoppingTrip = { id: tripId, completedAt: now, label, monthResetDate, listId };
    set((s) => ({
      trips: [trip, ...s.trips],
      items: s.items.map((i) =>
        i.status === 'inWeeklyList' && i.listId === listId
          ? { ...i, status: 'purchased' as const, purchasedAt: now, shoppingTripId: tripId, checked: false, collected: false }
          : i
      ),
    }));
    return tripId;
  },

  /**
   * Monthly reset, per the redesign's contract:
   *  1. Detach every trip's purchased items back to 'catalog' (clear trip refs), delete all trips.
   *  2. Delete all isTemporary=1 items outright.
   *  3. Clear pendingRestock on everything left.
   *  4. Revert any remaining 'inWeeklyList' item to 'catalog'.
   *  5. Permanent catalog items are never deleted — only their status/flags move.
   */
  monthlyReset() {
    db.runSync(
      "UPDATE shopping_items SET status = 'catalog', shopping_trip_id = NULL, purchased_at = NULL, checked = 0, collected = 0 WHERE shopping_trip_id IS NOT NULL"
    );
    db.runSync('DELETE FROM shopping_trips');
    db.runSync('DELETE FROM shopping_items WHERE is_temporary = 1');
    db.runSync('UPDATE shopping_items SET pending_restock = 0');
    db.runSync("UPDATE shopping_items SET status = 'catalog', checked = 0, collected = 0 WHERE status = 'inWeeklyList'");

    set((s) => ({
      trips: [],
      items: s.items
        .filter((i) => !i.isTemporary)
        .map((i) => {
          if (i.shoppingTripId || i.status === 'inWeeklyList') {
            return { ...i, status: 'catalog' as const, shoppingTripId: undefined, purchasedAt: undefined, pendingRestock: false, checked: false, collected: false };
          }
          return { ...i, pendingRestock: false };
        }),
    }));
  },

  /**
   * Snapshot for the monthly reset summary — must be called BEFORE monthlyReset(),
   * since that mutates/clears the very purchasedAt/shoppingTripId fields this reads.
   * inventoryItems/adHocItems are the purchased ShoppingItem rows themselves
   * (already chronologically sorted), matching MonthlyResetSummaryModal's contract.
   */
  buildMonthlyResetSummary() {
    const items = get().items;
    const lineTotal = (i: ShoppingItem) => i.price * (parseInt(i.amount, 10) || 1);
    const byPurchasedAt = (a: ShoppingItem, b: ShoppingItem) =>
      (a.purchasedAt ?? '').localeCompare(b.purchasedAt ?? '');

    const purchased = items.filter((i) => i.status === 'purchased');
    const inventoryPurchased = purchased.filter((i) => i.fromCatalog).sort(byPurchasedAt);
    const adHocPurchased = purchased.filter((i) => !i.fromCatalog).sort(byPurchasedAt);

    // "Full inventory list" value = everything that's part of the standing Katalog
    // right now (status='catalog') plus catalog-sourced rows currently checked out
    // for this trip (inWeeklyList/purchased, same row, fromCatalog carries over).
    const inventoryUniverse = items.filter((i) => !i.isTemporary && (i.status === 'catalog' || i.fromCatalog));
    const inventoryTotalValue = inventoryUniverse.reduce((sum, i) => sum + i.price * i.targetQuantity, 0);

    return {
      inventorySpent: inventoryPurchased.reduce((sum, i) => sum + lineTotal(i), 0),
      inventoryTotalValue,
      inventoryItems: inventoryPurchased,
      adHocItems: adHocPurchased,
    };
  },
}));
