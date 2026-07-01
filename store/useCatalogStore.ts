/**
 * useCatalogStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal suggest() contract Phase 3b's AddItemSheet and
 * AddDishSheet need for name-autocomplete, ahead of Phase 5's real catalog
 * store. Never call in a mounted app — throws to make accidental real usage
 * fail loudly instead of silently no-op'ing.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/AddItemSheet.tsx, components/AddDishSheet.tsx
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store
 *
 * Edit notes:
 *   - Signature corrected from Decision 015's original `suggest(name):
 *     string[]` to match verified old-source usage — see Decision 015a.
 *   - Phase 5 must implement this store to satisfy suggest() exactly as
 *     declared here. If the real store's needs differ, fix the contract
 *     there and re-typecheck the consuming sheets.
 */
export type CatalogSuggestion = { id: string; name: string; price: number };

type CatalogStoreState = {
  suggest: (name: string, limit?: number) => CatalogSuggestion[];
};

export function useCatalogStore<T>(selector: (s: CatalogStoreState) => T): T {
  return selector({
    suggest: () => {
      throw new Error('useCatalogStore is a Phase 5 stub (Decision 015a) — not implemented yet');
    },
  });
}
