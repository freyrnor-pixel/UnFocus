/**
 * shoppingGroups.ts — dish- and category-grouping helpers for shopping items.
 *
 * Pure functions shared by every screen that needs to bucket ShoppingItem rows by
 * their optional dishName (the "From meals" grouping Week lists and Monthly both use) or
 * by category (Monthly's category-cluster dividers).
 *
 * Connections:
 *   Imports → store/useShoppingStore (ShoppingItem type)
 *   Used by → app/shopping.tsx, components/WeekListCard.tsx (dishGroupAllChecked),
 *             components/HomeShoppingCard.tsx (listProgress), app/inventory-edit.tsx
 *             (catalogItemsForList)
 *   Data    → none — pure functions over arrays passed in by the caller
 *
 * Edit notes:
 *   - catalogItemsForList() (UX audit C2, 2026-07-23) is the one place that filters a Monthly
 *     list's status='catalog' rows — extracted so app/(tabs)/shopping.tsx's Monthly view and
 *     the resurrected app/inventory-edit.tsx (its "Manage inventory" entry point) can't drift
 *     into two slightly-different copies of the same filter/sort again.
 *   - groupByCategory() is Monthly-only — Weekly's "In list" rows keep their user-dragged
 *     orderIndex order and only get a per-row category tag, not a resort/regroup, so a manual
 *     drag never gets undone by a category re-cluster.
 *   - Not memoized — same cost as the inline filters this was extracted from; callers
 *     that render every frame should wrap calls in their own useMemo.
 *   - groupByDish() is also used standalone by the Monthly tab (no listId/status notion
 *     there, just catalog rows), while computeListGroups() is Week-list-specific
 *     (filters by status==='inWeeklyList' and a given listId first).
 *   - computeListGroups() dish grouping deliberately includes BOTH checked and unchecked
 *     items for a dish (2026-07-02, Phase 4 — Decision 011a/R4 wiring). Originally (Session
 *     A2·2) it grouped unchecked items only, which meant a fully-checked dish's items fell
 *     out of dishGroups entirely into the flat `checked` bucket, losing their dish grouping
 *     and making the roll-up "dish shows checked when all ingredients are checked" (Decision
 *     011a) structurally unobservable. Fixed by grouping the FULL per-list item set by dish
 *     first, then splitting only the ungrouped remainder into ungroupedUnchecked/checked.
 *   - dishGroupAllChecked() is the Decision 011a/R4 "computed allChecked" — always derived
 *     from the group's own items at read time, never persisted (011a decision #2). Consumed
 *     by WeekListCard's dish-group ExpandableCard header checkbox.
 *   - listProgress() (Session A2·2, not in the old repo) — Decision 017 note 3 requires the
 *     sticky header (focused list, full) and WeekListCard's own header (non-focused lists,
 *     compact) to share ONE progress calculation, not fork it. Both app/shopping.tsx and
 *     WeekListCard.tsx call this on the same computeListGroups() output rather than each
 *     computing remaining/inCart counts independently. Updated alongside the dish-grouping
 *     fix above so dish items still count correctly toward remaining/inCart by their own
 *     checked state, not by bucket membership.
 */
import { ShoppingItem } from '@/store/useShoppingStore';

/** One Monthly list's permanent-inventory rows (status='catalog'), name-sorted. Shared by
 *  app/(tabs)/shopping.tsx's Monthly view and app/inventory-edit.tsx (UX audit C2, 2026-07-23)
 *  so both read the exact same slice instead of duplicating the filter/sort. */
export function catalogItemsForList(items: ShoppingItem[], listId: string): ShoppingItem[] {
  return items
    .filter((i) => i.status === 'catalog' && i.monthlyListId === listId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Buckets items into dish groups (sorted by dish name) and an ungrouped leftover list. */
export function groupByDish(items: ShoppingItem[]): { dishGroups: [string, ShoppingItem[]][]; ungrouped: ShoppingItem[] } {
  const dishMap = new Map<string, ShoppingItem[]>();
  const ungrouped: ShoppingItem[] = [];
  for (const item of items) {
    if (item.dishName) {
      const group = dishMap.get(item.dishName);
      if (group) group.push(item);
      else dishMap.set(item.dishName, [item]);
    } else {
      ungrouped.push(item);
    }
  }
  return { dishGroups: Array.from(dishMap.entries()).sort((a, b) => a[0].localeCompare(b[0])), ungrouped };
}

/** Buckets one Week list's inWeeklyList items into dish groups (checked + unchecked members
 *  together, per Decision 011a) / ungrouped (orderIndex-sorted) / checked. */
export function computeListGroups(items: ShoppingItem[], listId: string) {
  const listItems = items.filter((i) => i.status === 'inWeeklyList' && i.listId === listId);
  const { dishGroups, ungrouped } = groupByDish(listItems);

  const ungroupedUnchecked = ungrouped
    .filter((i) => !i.checked)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const checked = ungrouped.filter((i) => i.checked).sort((a, b) => a.name.localeCompare(b.name));

  return { dishGroups, ungroupedUnchecked, checked };
}

/** Decision 011a derived state: a dish group reads as "checked" only when every one of its
 *  ingredients is checked. No persisted dish-level flag — always recomputed from the group's
 *  own ShoppingItem[] (see R4). */
export function dishGroupAllChecked(items: ShoppingItem[]): boolean {
  return items.length > 0 && items.every((i) => i.checked);
}

/** Buckets items by their category field (default 'other' for blank/undefined), sorted by
 *  category then name — used for the Monthly tab's quiet category-cluster dividers. Not used
 *  for Weekly's "In list" rows, which stay in their user-dragged orderIndex order instead. */
export function groupByCategory(items: ShoppingItem[]): [string, ShoppingItem[]][] {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || 'other';
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  for (const group of map.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** One shared remaining/in-cart/percent calculation for a list — see header note.
 *  Dish-group items now carry their own checked state (Decision 011a) rather than living
 *  exclusively in either bucket, so they're split by that state here instead of being
 *  counted wholesale as "remaining." */
export function listProgress(groups: {
  dishGroups: [string, ShoppingItem[]][];
  ungroupedUnchecked: ShoppingItem[];
  checked: ShoppingItem[];
}): { remaining: number; inCart: number; total: number; pct: number } {
  const dishItems = groups.dishGroups.flatMap(([, dishItems]) => dishItems);
  const dishRemaining = dishItems.filter((i) => !i.checked).length;
  const dishChecked = dishItems.filter((i) => i.checked).length;
  const remaining = groups.ungroupedUnchecked.length + dishRemaining;
  const inCart = groups.checked.length + dishChecked;
  const total = remaining + inCart;
  return { remaining, inCart, total, pct: total > 0 ? inCart / total : 0 };
}

/**
 * Running cost of every item in a list's three buckets: `price × amount` summed
 * across dish-group, ungrouped-unchecked, and checked rows (amount parsed as an
 * int, defaulting to 1 for blank/NaN). Used for the WeekListCard footer total —
 * shares the same computeListGroups() output as listProgress() so the total and
 * the progress line never disagree about which rows belong to the list.
 */
export function listTotal(groups: {
  dishGroups: [string, ShoppingItem[]][];
  ungroupedUnchecked: ShoppingItem[];
  checked: ShoppingItem[];
}): number {
  const all = [
    ...groups.dishGroups.flatMap(([, dishItems]) => dishItems),
    ...groups.ungroupedUnchecked,
    ...groups.checked,
  ];
  return all.reduce((sum, i) => sum + i.price * (parseInt(i.amount, 10) || 1), 0);
}
