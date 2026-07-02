/**
 * useMealStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal dishes contract Phase 3b's AddDishSheet needs for its
 * "From Meals" picker, ahead of Phase 5's real meal store. Never call in a
 * mounted app — throws to make accidental real usage fail loudly instead of
 * silently no-op'ing.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/AddDishSheet.tsx, app/shopping.tsx (dishes prop into
 *             WeekListCard's "From meals" groups; WeekListCard itself only imports the
 *             Dish type, the hook call lives in the screen)
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy Dish exactly as declared
 *     here (Decision 015). If the real store's needs differ, fix the contract
 *     there and re-typecheck the consuming sheet.
 */
export type Dish = {
  id: string;
  name: string;
  ingredients: { name: string; amount: string; unit: string }[];
};

type MealStoreState = {
  dishes: Dish[];
};

export function useMealStore<T>(selector: (s: MealStoreState) => T): T {
  return selector({
    dishes: [],
  });
}
