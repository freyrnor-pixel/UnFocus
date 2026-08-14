/**
 * shoppingCategories.ts — preset category list for the shopping-item add forms.
 *
 * `ShoppingItem.category` / `StoreItem.category` are free-text columns that already exist
 * end-to-end in the data layer (default `'other'`) but had no UI anywhere to set or see them.
 * This is the small, fixed preset list surfaced in the add forms so categorising an item is a
 * single optional tap, not free typing — the stored value is still a plain string underneath.
 *
 * Connections:
 *   Imports → lib/i18n (Translations type only)
 *   Used by → components/InlineAddItem.tsx (Weekly + Monthly add forms), app/(tabs)/shopping.tsx
 *             (Monthly category clustering + Monthly-tab filter), components/ShoppingFilterBar.tsx
 *             (category dropdown, used by WeekListCard.tsx, AddFromMonthlyModal.tsx and the
 *             Monthly tab — category is now an actual filter, not just a display tag)
 *   Data    → none — pure preset list + label lookup
 */
import { Translations } from '@/lib/i18n';

/**
 * The app's ONE shopping-category vocabulary — in shop-walk order, which is what the
 * "In the store" layout's aisle headers read down (`groupByAisle`, lib/cardLayout.ts).
 *
 * **There were TWO of these until 2026-08-13, and the bigger half of the data was filed
 * under the one nothing read.** This list held 8 values while `lib/catalogSeed.ts` and
 * `app/scan.tsx` used a different 12; only produce/dairy/frozen appeared in both, so **205
 * of the catalogue's 286 seeded items** carried a value `categoryLabel()` had never heard
 * of and fell through its `?? other` to render as "Annet". Three live consequences: "In the
 * store" mode drew one giant Other aisle, the category filter could never match a seeded
 * item, and app/scan.tsx rendered the raw English key as its picker label.
 *
 * Resolved by GROWING this list to the seed's aisle granularity rather than collapsing the
 * seed into the old 8 — collapsing put 108 of 286 items into a single "Pantry" and would
 * have gutted the one feature these values exist for. Existing rows are migrated in
 * lib/db.ts; see that migration for the two mappings that are judgement calls.
 *
 * Adding a value means: a `categoryLabels` entry in BOTH languages (tsc enforces the pair),
 * and nothing else — `categoryPresets`/`categoryLabel` are derived. Removing one means a
 * migration, because it is a stored string.
 * `lib/__tests__/shoppingCategories.test.ts` pins the seed against this list.
 */
export const CATEGORY_VALUES = [
  'produce',
  'bakery',
  'dairy',
  'meat',
  'fish',
  'frozen',
  'pantry',
  'canned',
  'snacks',
  'drinks',
  'cleaning',
  'personal',
  'other',
] as const;

export type CategoryValue = (typeof CATEGORY_VALUES)[number];

/** Preset (value, localised label) pairs for the category chip picker. */
export function categoryPresets(t: Translations): { value: string; label: string }[] {
  return CATEGORY_VALUES.map((value) => ({ value, label: t.categoryLabels[value] }));
}

/** Localised label for a stored category value, falling back to "Other" for unknown/blank values. */
export function categoryLabel(t: Translations, category: string | undefined): string {
  const key = (category ?? 'other') as CategoryValue;
  return t.categoryLabels[key] ?? t.categoryLabels.other;
}

/**
 * Sort rank for a stored category value — its index in `CATEGORY_VALUES`, i.e. shop-walk
 * order, with anything unrecognised sorted last alongside 'other'.
 *
 * Extracted (2026-08-13) for the Catalogue's "Sort by type" toggle. Pure and dependency-free
 * on purpose: it is the whole of that feature's logic, so it is the part worth a unit test,
 * and a comparator buried in a component's `useMemo` is not testable.
 *
 * A rank rather than a `localeCompare` on the LABEL: sorting by the translated word would
 * put the aisles in a different order in Norwegian than in English, and neither would be
 * the order of the shop.
 */
export function categoryRank(category: string | undefined): number {
  const i = CATEGORY_VALUES.indexOf((category ?? 'other') as CategoryValue);
  return i === -1 ? CATEGORY_VALUES.length : i;
}

/**
 * Order a list by category (shop-walk order), then by name within each category.
 *
 * Generic over anything carrying a `name` and a `category`, since the catalogue's `StoreItem`
 * and a shopping row are different types with the same two fields. **Returns a new array and
 * never mutates** — this is a presentation-layer sort, and its callers' stored order is either
 * the store's own Norwegian collation (`useCatalogStore.load`) or a user-dragged order
 * (`lib/useDragReorder.ts`). Sorting must never be written back.
 */
export function sortByCategoryThenName<T extends { name: string; category?: string }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name, 'no')
  );
}
