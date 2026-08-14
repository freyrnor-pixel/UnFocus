/**
 * shoppingCategories.test.ts — the app has ONE shopping-category vocabulary.
 *
 * Written 2026-08-13, after finding that it had two. `lib/shoppingCategories.ts` defined 8
 * values and drove every label, filter and "In the store" aisle header; `lib/catalogSeed.ts`
 * and `app/scan.tsx` used a different 12. Only produce/dairy/frozen appeared in both, so
 * **205 of the catalogue's 286 seeded items** carried a value `categoryLabel()` had never
 * heard of and fell through its `?? other` fallback to render as "Annet"/"Other".
 *
 * Nothing caught it because nothing crashed: a free-text column accepts any string, and the
 * fallback made the failure look like a deliberate "uncategorised". It was visible only as
 * "In the store" mode drawing one giant Other aisle — a rendering nobody had a baseline for.
 *
 * These are cheap because all three modules are dependency-free (no store, no DB, no i18n
 * beyond the type), which is the property to preserve if you extend this file.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { CATALOG_SEED } from '@/lib/catalogSeed';
import { CATEGORY_VALUES, categoryLabel, categoryRank, sortByCategoryThenName } from '@/lib/shoppingCategories';
import { getTranslations } from '@/lib/i18n';

const ROOT = join(__dirname, '..', '..');

/** The vocabulary, taken from the module rather than restated — a copy here could drift too. */
const VALUES: readonly string[] = CATEGORY_VALUES;
const en = getTranslations('en');
const no = getTranslations('no');

describe('one shopping-category vocabulary', () => {
  test('the seed only uses values the app knows', () => {
    const unknown = [...new Set(CATALOG_SEED.map((i) => i.category))].filter((c) => !VALUES.includes(c));
    expect(unknown).toEqual([]);
  });

  test('the seed is the size this vocabulary was grown to cover', () => {
    // A canary, not a target: if this number moves, someone edited catalogSeed.ts, and that
    // means CATALOG_SEED_VERSION has to move too or the re-seed never runs (see below).
    expect(CATALOG_SEED).toHaveLength(286);
  });

  test('every value has a label in BOTH languages', () => {
    // tsc already enforces `no: typeof en` for the shape; this catches the other half — a
    // value added to CATEGORY_VALUES but not to categoryLabels, which types fine (the lookup
    // is indexed) and silently renders every row in that aisle as "Other".
    for (const value of VALUES) {
      expect(en.categoryLabels[value as keyof typeof en.categoryLabels]).toBeTruthy();
      expect(no.categoryLabels[value as keyof typeof no.categoryLabels]).toBeTruthy();
    }
  });

  test('the retired spellings are gone from the seed', () => {
    // The four values the 2026-08-13 merge mapped away. `lib/db.ts` migrates rows written
    // under them, but the seed itself must never reintroduce one — a re-seed would undo the
    // migration for every catalogue row on every install.
    const retired = ['bread', 'dry', 'meatFish', 'household'];
    const used = new Set(CATALOG_SEED.map((i) => i.category));
    expect(retired.filter((r) => used.has(r))).toEqual([]);
  });

  test('no module keeps a private copy of the category list', () => {
    // app/scan.tsx held its own `CATEGORIES` array — the second source of truth that made the
    // drift possible, and which also rendered raw English keys as its picker labels. Any file
    // needing the list calls categoryPresets(t).
    const scan = readFileSync(join(ROOT, 'app/scan.tsx'), 'utf8');
    expect(scan).not.toMatch(/const CATEGORIES\s*=/);
    expect(scan).toContain('categoryPresets');
  });

  test('editing the seed forces a CATALOG_SEED_VERSION bump', () => {
    // seedCatalog() re-syncs price AND category for price_source='seed' rows, but ONLY when
    // the version string changes — so a seed edit without a bump reaches new installs and no
    // existing one. '3' is the bump that carried the category rewrite; a later seed edit needs
    // its own, and updating this expectation is the reminder to do it.
    const store = readFileSync(join(ROOT, 'store/useCatalogStore.ts'), 'utf8');
    expect(store).toMatch(/const CATALOG_SEED_VERSION = '3'/);
  });

  test('categoryLabel falls back rather than throwing on a stored unknown', () => {
    // The fallback stays — a free-text column can hold anything, including a value from a
    // future build a synced peer wrote. What changed is that it is no longer load-bearing for
    // 72% of the catalogue.
    expect(categoryLabel(en, 'definitely-not-a-category')).toBe(en.categoryLabels.other);
    expect(categoryLabel(en, undefined)).toBe(en.categoryLabels.other);
    expect(categoryLabel(no, 'dry')).toBe(no.categoryLabels.other);
  });
});

/**
 * The Catalogue's "Sort by type" toggle (2026-08-13). All of its logic lives in these two pure
 * functions precisely so it can be tested — a comparator inside a component's `useMemo` cannot.
 */
describe('sortByCategoryThenName', () => {
  const rows = [
    { name: 'Zucchini', category: 'produce' },
    { name: 'Melk', category: 'dairy' },
    { name: 'Agurk', category: 'produce' },
    { name: 'Såpe', category: 'cleaning' },
    { name: 'Brød', category: 'bakery' },
  ];

  test('orders by aisle, then by name inside each aisle', () => {
    expect(sortByCategoryThenName(rows).map((r) => r.name)).toEqual([
      // produce (0) → bakery (1) → dairy (2) → cleaning (10): shop-walk order, not the
      // alphabetical order of either the values or their labels.
      'Agurk',
      'Zucchini',
      'Brød',
      'Melk',
      'Såpe',
    ]);
  });

  test('never mutates its input — the stored order is the store\'s, or the user\'s drag order', () => {
    const before = rows.map((r) => r.name);
    sortByCategoryThenName(rows);
    expect(rows.map((r) => r.name)).toEqual(before);
  });

  test('sorts unknown and missing categories last, with "other"', () => {
    const mixed = [
      { name: 'Ukjent', category: 'from-a-future-build' },
      { name: 'Annet', category: 'other' },
      { name: 'Blank', category: undefined },
      { name: 'Eple', category: 'produce' },
    ];
    expect(sortByCategoryThenName(mixed)[0].name).toBe('Eple');
    // 'other' is the last real value; anything unrecognised ranks past it rather than
    // silently landing at the front, which is what an `indexOf` of -1 would have done.
    expect(categoryRank('from-a-future-build')).toBeGreaterThan(categoryRank('other'));
    expect(categoryRank(undefined)).toBe(categoryRank('other'));
  });

  test('name ordering is Norwegian-collated, matching the store', () => {
    // useCatalogStore.load() sorts with localeCompare(name, 'no'); a different collation here
    // would make the two orders disagree on æ/ø/å the moment you flipped the toggle back.
    const nordic = [
      { name: 'Ål', category: 'fish' },
      { name: 'Abbor', category: 'fish' },
      { name: 'Ørret', category: 'fish' },
    ];
    expect(sortByCategoryThenName(nordic).map((r) => r.name)).toEqual(['Abbor', 'Ørret', 'Ål']);
  });
});
