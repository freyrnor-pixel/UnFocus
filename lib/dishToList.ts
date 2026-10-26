/**
 * dishToList.ts — a dish's ingredients as shopping-row inputs (2026-10-26).
 *
 * The same loop used to live three times (AddDishSheet.handleAddDish, FoodTab.handleAddToWeek,
 * FoodTab.pushDishToMonthlyList), each with its own copy of the field list and its own
 * `parseInt(ing.amount)`. One pure builder now; callers only pass the result to
 * useShoppingStore.add(), which does the unit-aware consolidation (lib/quantity.ts).
 *
 * - Weekly target: the ingredient's own amount + unit go onto the row.
 * - Monthly target (a catalog row): amount stays '1' and the ingredient's amount becomes the
 *   row's whole-number targetQuantity, as before — now "1,5" rounds to 2 instead of reading 1.
 *
 * Connections:
 *   Imports → lib/quantity (amountToCount), store/useMealStore (Dish type),
 *             store/useShoppingStore (ShoppingItemInput type)
 *   Used by → components/AddDishSheet.tsx, components/FoodTab.tsx, lib/__tests__/quantity.test.ts
 *   Data    → none (pure)
 */
import { amountToCount } from '@/lib/quantity';
import type { Dish } from '@/store/useMealStore';
import type { ShoppingItemInput } from '@/store/useShoppingStore';

export type DishTarget = { mode: 'weekly'; listId: string } | { mode: 'monthly'; listId: string };

export function dishToShoppingInputs(dish: Dish, target: DishTarget): ShoppingItemInput[] {
  return dish.ingredients.map((ing) =>
    target.mode === 'weekly'
      ? {
          name: ing.name,
          amount: ing.amount || '1',
          unit: ing.unit,
          listType: 'weekly',
          store: '',
          price: ing.priceNok,
          inventoryQty: 0,
          status: 'inWeeklyList',
          listId: target.listId,
          dishName: dish.name,
        }
      : {
          name: ing.name,
          amount: '1',
          unit: ing.unit,
          listType: 'monthly',
          store: '',
          price: ing.priceNok,
          inventoryQty: 0,
          status: 'catalog',
          targetQuantity: amountToCount(ing.amount),
          dishName: dish.name,
          monthlyListId: target.listId,
        },
  );
}
