/**
 * useMealStore.ts — dishes and their ingredients (meal planning)
 *
 * Zustand store for saved dishes (by meal type) and their nested ingredient
 * lists. Backs the meals screen and the randomDish() "what should I cook" picker;
 * ingredients can be pushed onto the shopping list from the consuming screen.
 * Real Phase 5/6 port replacing the Decision 015 typed-interface stub.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/dishSeed (DISH_SEED), lib/i18n (getTranslations)
 *   Used by → components/FoodTab.tsx (the Shopping screen's in-place "Food" tab — dish CRUD +
 *             push-to-list), components/AddDishToMonthlySheet.tsx (Monthly tab dish picker →
 *             push-to-list), app/(tabs)/shopping.tsx (indirect, via FoodTab)
 *   Data    → defines a Zustand store; owns SQLite tables dishes and ingredients (1-to-many)
 *
 * Edit notes:
 *   - ingredients are loaded in one query and grouped onto dishes in JS (loadDishes), not via a JOIN.
 *   - dishes/ingredients are configuration, not dated history — they are NOT pruned by RETENTION_DAYS; deleting a dish cascades to its ingredients (FK ON DELETE CASCADE).
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - `Ingredient.priceNok` (column `price_nok`, Shopping/Food redesign) is the per-ingredient
 *     line price. `dishTotalPrice(dish)` sums these — that's the "total price" shown on a dish
 *     row in FoodTab, and the price carried onto the shopping_items rows a dish push creates.
 *     `estimatedPriceNok` on the dish itself is legacy/display-only and no longer the source of
 *     the shown total.
 *   - seedDishes() runs on every load() with stable ids ('dish_<name>') + INSERT OR IGNORE — safe
 *     to re-run; mirrors useHealthStore.seedSymptoms(). Renaming a seed entry orphans old rows.
 *   - duplicateDish() copies a dish + its ingredients under a new id, suffixing the name via
 *     getTranslations().dishCopySuffix (stores can't call useT(), see lib/i18n.ts header).
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, SQLValue, loadAll, insertRow, updateRow, readStr, readReal, readEnum } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { DISH_SEED } from '@/lib/dishSeed';
import { getTranslations } from '@/lib/i18n';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'kveldsmat';
export type Difficulty = 'easy' | 'normal';
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal'];

export type Ingredient = {
  id: string;
  dishId: string;
  name: string;
  amount: string;
  unit: string;
  /** Line price for this ingredient in NOK (a dish's total price is the sum of these). */
  priceNok: number;
};

export type Dish = {
  id: string;
  name: string;
  mealType: MealType;
  difficulty: Difficulty;
  estimatedPriceNok: number;
  ingredients: Ingredient[];
};

/** A dish's total price = the sum of its ingredients' line prices. */
export function dishTotalPrice(dish: Dish): number {
  return dish.ingredients.reduce((sum, i) => sum + (i.priceNok || 0), 0);
}

type MealStore = {
  dishes: Dish[];
  load: () => void;
  addDish: (d: { name: string; mealType: MealType; difficulty?: Difficulty; estimatedPriceNok?: number }) => Dish;
  updateDish: (id: string, patch: { name?: string; mealType?: MealType; difficulty?: Difficulty; estimatedPriceNok?: number }) => void;
  removeDish: (id: string) => void;
  duplicateDish: (id: string) => Dish | undefined;
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
    priceNok: readReal(row, 'price_nok'),
  };
}

function loadDishes(): Dish[] {
  const dishes = loadAll(
    'dishes',
    (d): Omit<Dish, 'ingredients'> => ({
      id: readStr(d, 'id'),
      name: readStr(d, 'name'),
      mealType: readStr(d, 'meal_type') as MealType,
      difficulty: readEnum(d, 'difficulty', DIFFICULTIES, 'normal'),
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

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

function seedDishes(): void {
  for (const d of DISH_SEED) {
    const dishId = 'dish_' + slug(d.name);
    try {
      db.runSync(
        `INSERT OR IGNORE INTO dishes (id, name, meal_type, difficulty) VALUES (?, ?, ?, ?)`,
        [dishId, d.name, d.mealType, d.difficulty]
      );
      for (const ing of d.ingredients) {
        db.runSync(
          `INSERT OR IGNORE INTO ingredients (id, dish_id, name, amount, unit, price_nok) VALUES (?, ?, ?, ?, ?, ?)`,
          [dishId + '_' + slug(ing.name), dishId, ing.name, ing.amount, ing.unit, ing.priceNok]
        );
      }
    } catch (err) {
      console.error(`Failed to seed dish ${d.name}:`, err);
    }
  }
}

export const useMealStore = create<MealStore>((set, get) => ({
  dishes: [],

  load() {
    seedDishes();
    set({ dishes: loadDishes() });
  },

  addDish({ name, mealType, difficulty = 'normal', estimatedPriceNok = 0 }) {
    const id = generateId();
    insertRow('dishes', { id, name, meal_type: mealType, difficulty, estimated_price_nok: estimatedPriceNok });
    const dish: Dish = { id, name, mealType, difficulty, estimatedPriceNok, ingredients: [] };
    set((s) => ({ dishes: [...s.dishes, dish] }));
    return dish;
  },

  updateDish(id, patch) {
    const dish = get().dishes.find((d) => d.id === id);
    if (!dish) return;
    const values: Record<string, SQLValue> = {};
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.mealType !== undefined) values.meal_type = patch.mealType;
    if (patch.difficulty !== undefined) values.difficulty = patch.difficulty;
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

  duplicateDish(id) {
    const source = get().dishes.find((d) => d.id === id);
    if (!source) return undefined;
    const t = getTranslations();
    const newId = generateId();
    const name = source.name + t.dishCopySuffix;
    insertRow('dishes', {
      id: newId,
      name,
      meal_type: source.mealType,
      difficulty: source.difficulty,
      estimated_price_nok: source.estimatedPriceNok,
    });
    const ingredients: Ingredient[] = source.ingredients.map((ing) => {
      const ingId = generateId();
      insertRow('ingredients', {
        id: ingId,
        dish_id: newId,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        price_nok: ing.priceNok,
      });
      return { ...ing, id: ingId, dishId: newId };
    });
    const dish: Dish = { ...source, id: newId, name, ingredients };
    set((s) => ({ dishes: [...s.dishes, dish] }));
    return dish;
  },

  addIngredient(i) {
    const id = generateId();
    insertRow('ingredients', { id, dish_id: i.dishId, name: i.name, amount: i.amount, unit: i.unit, price_nok: i.priceNok ?? 0 });
    const ingredient: Ingredient = { ...i, id, priceNok: i.priceNok ?? 0 };
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
