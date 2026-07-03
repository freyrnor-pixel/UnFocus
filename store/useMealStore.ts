/**
 * useMealStore.ts — dishes and their ingredients (meal planning)
 *
 * Zustand store for saved dishes (by meal type) and their nested ingredient
 * lists. Backs the meals screen and the randomDish() "what should I cook" picker;
 * ingredients can be pushed onto the shopping list from the consuming screen.
 * Real Phase 5/6 port replacing the Decision 015 typed-interface stub.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id
 *   Used by → app/meals.tsx, components/AddDishSheet.tsx (read-only "From Meals" picker),
 *             app/shopping.tsx (read-only, dishes prop into WeekListCard groups)
 *   Data    → defines a Zustand store; owns SQLite tables dishes and ingredients (1-to-many)
 *
 * Edit notes:
 *   - ingredients are loaded in one query and grouped onto dishes in JS (loadDishes), not via a JOIN.
 *   - dishes/ingredients are configuration, not dated history — they are NOT pruned by RETENTION_DAYS; deleting a dish cascades to its ingredients (FK ON DELETE CASCADE).
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - Decision 015/015a: AddDishSheet only reads `dishes` + each dish's `id`/`name`/
 *     `ingredients[].name/amount/unit` — the richer Dish type here (mealType,
 *     estimatedPriceNok, Ingredient.id/dishId) is a superset of the stub it consumed.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, SQLValue, loadAll, insertRow, updateRow, readStr, readReal } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'kveldsmat';

export type Ingredient = {
  id: string;
  dishId: string;
  name: string;
  amount: string;
  unit: string;
};

export type Dish = {
  id: string;
  name: string;
  mealType: MealType;
  estimatedPriceNok: number;
  ingredients: Ingredient[];
};

type MealStore = {
  dishes: Dish[];
  load: () => void;
  addDish: (d: { name: string; mealType: MealType; estimatedPriceNok?: number }) => Dish;
  updateDish: (id: string, patch: { name?: string; mealType?: MealType; estimatedPriceNok?: number }) => void;
  removeDish: (id: string) => void;
  addIngredient: (i: Omit<Ingredient, 'id'>) => void;
  removeIngredient: (id: string) => void;
  randomDish: (mealType?: MealType) => Dish | undefined;
};

function rowToIngredient(row: Row): Ingredient {
  return {
    id: readStr(row, 'id'),
    dishId: readStr(row, 'dish_id'),
    name: readStr(row, 'name'),
    amount: readStr(row, 'amount'),
    unit: readStr(row, 'unit'),
  };
}

function loadDishes(): Dish[] {
  const dishes = loadAll(
    'dishes',
    (d): Omit<Dish, 'ingredients'> => ({
      id: readStr(d, 'id'),
      name: readStr(d, 'name'),
      mealType: readStr(d, 'meal_type') as MealType,
      estimatedPriceNok: readReal(d, 'estimated_price_nok'),
    }),
    { orderBy: 'name' }
  );

  // Group ingredients onto their dish in a single pass (was an O(dishes×ingredients) filter).
  const byDish = new Map<string, Ingredient[]>();
  for (const ing of loadAll('ingredients', rowToIngredient, { orderBy: 'name' })) {
    const list = byDish.get(ing.dishId);
    if (list) list.push(ing);
    else byDish.set(ing.dishId, [ing]);
  }

  return dishes.map((d) => ({ ...d, ingredients: byDish.get(d.id) ?? [] }));
}

export const useMealStore = create<MealStore>((set, get) => ({
  dishes: [],

  load() {
    set({ dishes: loadDishes() });
  },

  addDish({ name, mealType, estimatedPriceNok = 0 }) {
    const id = generateId();
    insertRow('dishes', { id, name, meal_type: mealType, estimated_price_nok: estimatedPriceNok });
    const dish: Dish = { id, name, mealType, estimatedPriceNok, ingredients: [] };
    set((s) => ({ dishes: [...s.dishes, dish] }));
    return dish;
  },

  updateDish(id, patch) {
    const dish = get().dishes.find((d) => d.id === id);
    if (!dish) return;
    const values: Record<string, SQLValue> = {};
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.mealType !== undefined) values.meal_type = patch.mealType;
    if (patch.estimatedPriceNok !== undefined) values.estimated_price_nok = patch.estimatedPriceNok;
    updateRow('dishes', values, 'id = ?', [id]);
    set((s) => ({
      dishes: s.dishes.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  },

  removeDish(id) {
    db.runSync('DELETE FROM dishes WHERE id = ?', [id]);
    set((s) => ({ dishes: s.dishes.filter((d) => d.id !== id) }));
  },

  addIngredient(i) {
    const id = generateId();
    insertRow('ingredients', { id, dish_id: i.dishId, name: i.name, amount: i.amount, unit: i.unit });
    const ingredient: Ingredient = { ...i, id };
    set((s) => ({
      dishes: s.dishes.map((d) =>
        d.id === i.dishId
          ? { ...d, ingredients: [...d.ingredients, ingredient] }
          : d
      ),
    }));
  },

  removeIngredient(id) {
    db.runSync('DELETE FROM ingredients WHERE id = ?', [id]);
    set((s) => ({
      dishes: s.dishes.map((d) => ({
        ...d,
        ingredients: d.ingredients.filter((i) => i.id !== id),
      })),
    }));
  },

  randomDish(mealType) {
    const { dishes } = get();
    const pool = mealType
      ? dishes.filter((d) => d.mealType === mealType)
      : dishes;
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  },
}));
