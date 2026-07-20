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
 *             (Monthly category clustering)
 *   Data    → none — pure preset list + label lookup
 */
import { Translations } from '@/lib/i18n';

export const CATEGORY_VALUES = [
  'produce',
  'dairy',
  'meatFish',
  'bakery',
  'pantry',
  'frozen',
  'household',
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
