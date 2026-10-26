/**
 * restock.ts — which Katalog items are under their target (2026-10-26).
 *
 * `inventoryQty` (how many you have, set in the payday review sheet) and `targetQuantity`
 * (how many you want) sat side by side on every catalog row with nothing comparing them.
 * Grocy's `stock_missing_products` view is that comparison (`min_stock_amount − stock`); this
 * is the same rule for one person: an item is wanted on the week list while it has fewer than
 * its target. An item nobody has counted reads 0 and so counts as wanted — which keeps the old
 * "take the whole base" behaviour for anyone who never fills in the review sheet.
 *
 * Connections:
 *   Imports → store/useShoppingStore (ShoppingItem type only)
 *   Used by → components/AddFromMonthlyModal.tsx (the "Make week list from here" preselection),
 *             lib/__tests__/restock.test.ts
 *   Data    → none (pure)
 */
import type { ShoppingItem } from '@/store/useShoppingStore';

type Stocked = Pick<ShoppingItem, 'inventoryQty' | 'targetQuantity'>;

/** Fewer on hand than wanted. */
export function isUnderTarget(item: Stocked): boolean {
  return (item.inventoryQty ?? 0) < Math.max(1, item.targetQuantity ?? 1);
}

/** How many more it takes to reach the target (0 when there are enough). */
export function missingCount(item: Stocked): number {
  return Math.max(0, Math.max(1, item.targetQuantity ?? 1) - (item.inventoryQty ?? 0));
}

/** The ids "Make week list from here" ticks for you: everything under its target. */
export function restockIds(items: (Stocked & { id: string })[]): Set<string> {
  return new Set(items.filter(isUnderTarget).map((i) => i.id));
}
