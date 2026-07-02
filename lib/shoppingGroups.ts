/**
 * shoppingGroups.ts — dish-grouping helpers for shopping items.
 *
 * Pure functions shared by every screen that needs to bucket ShoppingItem rows by
 * their optional dishName (the "From meals" grouping Week lists and Monthly both use).
 *
 * Connections:
 *   Imports → store/useShoppingStore (ShoppingItem type)
 *   Used by → app/shopping.tsx
 *   Data    → none — pure functions over arrays passed in by the caller
 *
 * Edit notes:
 *   - Not memoized — same cost as the inline filters this was extracted from; callers
 *     that render every frame should wrap calls in their own useMemo.
 *   - groupByDish() is also used standalone by the Monthly tab (no listId/status notion
 *     there, just catalog rows), while computeListGroups() is Week-list-specific
 *     (filters by status==='inWeeklyList' and a given listId first).
 *   - Direct port (2026-07-02, Session A2·2) — unchanged from the old repo.
 *   - listProgress() is new (Session A2·2, not in the old repo) — Decision 017 note 3
 *     requires the sticky header (focused list, full) and WeekListCard's own header
 *     (non-focused lists, compact) to share ONE progress calculation, not fork it. Both
 *     app/shopping.tsx and WeekListCard.tsx call this on the same computeListGroups()
 *     output rather than each computing remaining/inCart counts independently.
 */
import { ShoppingItem } from '@/store/useShoppingStore';

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

/** Buckets one Week list's inWeeklyList items into dish groups / ungrouped (orderIndex-sorted) / checked. */
export function computeListGroups(items: ShoppingItem[], listId: string) {
  const unchecked = items.filter((i) => i.status === 'inWeeklyList' && !i.checked && i.listId === listId);
  const checked = items
    .filter((i) => i.status === 'inWeeklyList' && i.checked && i.listId === listId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { dishGroups, ungrouped: ungroupedUnchecked } = groupByDish(unchecked);
  ungroupedUnchecked.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return { dishGroups, ungroupedUnchecked, checked };
}

/** One shared remaining/in-cart/percent calculation for a list — see header note. */
export function listProgress(groups: {
  dishGroups: [string, ShoppingItem[]][];
  ungroupedUnchecked: ShoppingItem[];
  checked: ShoppingItem[];
}): { remaining: number; inCart: number; total: number; pct: number } {
  const remaining = groups.ungroupedUnchecked.length + groups.dishGroups.reduce((sum, [, items]) => sum + items.length, 0);
  const inCart = groups.checked.length;
  const total = remaining + inCart;
  return { remaining, inCart, total, pct: total > 0 ? inCart / total : 0 };
}
