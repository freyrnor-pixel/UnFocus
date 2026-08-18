/**
 * shoppingStarters.test.ts — the quick-add bundles stay wired to the things they depend on.
 *
 * `lib/shoppingStarters.ts` is dependency-free by design (it is read from a render path), so
 * the three constraints its header states cannot be enforced by the type system and are
 * checked here instead. Each one fails silently in the app rather than loudly:
 *
 *   1. **A bundle name the catalogue doesn't know** gets no price and no category autofill, so
 *      it lands as a bare 0 kr row while its neighbours from the same tap land complete. The
 *      list still works; it just quietly looks half-broken.
 *   2. **A category outside `CATEGORY_VALUES`** falls through `categoryLabel`'s `?? other` and
 *      the item renders under "Annet" in the aisle grouping — which is precisely the bug the
 *      2026-07-20 category pass existed to fix, reintroduced one row at a time.
 *   3. **A missing i18n title** is a runtime `undefined` on a chip label in one language only,
 *      and `no: typeof en` cannot catch it because the ids are data, not keys of a literal.
 *
 * Same shape as lib/__tests__/habitStarters.test.ts and goalStarters.test.ts, which pin the
 * equivalent structure/i18n agreement for their own starter data.
 */
import { SHOPPING_STARTERS, MAX_STARTER_ITEMS } from '@/lib/shoppingStarters';
import { CATEGORY_VALUES } from '@/lib/shoppingCategories';
import { CATALOG_SEED } from '@/lib/catalogSeed';
import { getTranslations } from '@/lib/i18n';

const LANGS = ['en', 'no', 'is'] as const;

describe('the bundles themselves', () => {
  it('exist, and the scan is not vacuous', () => {
    expect(SHOPPING_STARTERS.length).toBeGreaterThan(0);
    expect(SHOPPING_STARTERS.every((s) => s.items.length > 0)).toBe(true);
  });

  it('have unique ids', () => {
    const ids = SHOPPING_STARTERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stay short — a bundle long enough to need editing down has cost more than it saved', () => {
    for (const starter of SHOPPING_STARTERS) {
      expect(starter.items.length).toBeLessThanOrEqual(MAX_STARTER_ITEMS);
    }
  });

  it('never repeat an item inside one bundle', () => {
    // add() would silently merge the duplicate into ×2, so this is invisible at runtime.
    for (const starter of SHOPPING_STARTERS) {
      const names = starter.items.map((i) => i.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('agreement with the things a bundle depends on', () => {
  const seed = new Map(CATALOG_SEED.map((i) => [i.name, i]));

  it.each(SHOPPING_STARTERS.map((s) => [s.id, s] as const))(
    '%s: every item is a real catalogue row, so it arrives with its price',
    (_id, starter) => {
      for (const item of starter.items) {
        expect(seed.has(item.name)).toBe(true);
      }
    }
  );

  it.each(SHOPPING_STARTERS.map((s) => [s.id, s] as const))(
    '%s: every item agrees with the catalogue about its category',
    (_id, starter) => {
      for (const item of starter.items) {
        expect(item.category).toBe(seed.get(item.name)?.category);
      }
    }
  );

  it('uses only real category values', () => {
    for (const starter of SHOPPING_STARTERS) {
      for (const item of starter.items) {
        expect(CATEGORY_VALUES).toContain(item.category as (typeof CATEGORY_VALUES)[number]);
      }
    }
  });
});

describe('i18n', () => {
  it.each(LANGS)('%s has a non-empty title for every bundle, and a tray label', (lang) => {
    const t = getTranslations(lang);
    expect(typeof t.shoppingStarters.trayLabel).toBe('string');
    expect(t.shoppingStarters.trayLabel.length).toBeGreaterThan(0);
    for (const starter of SHOPPING_STARTERS) {
      const title = (t.shoppingStarters as Record<string, unknown>)[starter.id];
      expect(typeof title).toBe('string');
      expect((title as string).length).toBeGreaterThan(0);
    }
  });

  it.each(LANGS)('%s counts items in the confirmation, singular and plural', (lang) => {
    const t = getTranslations(lang);
    expect(t.shoppingStarters.added(1)).toContain('1');
    expect(t.shoppingStarters.added(5)).toContain('5');
    // Icelandic takes the singular for any number ending in 1 except 11 — 21 must read like
    // 1, not like 5. A bare `n === 1` passes every other assertion here and fails this one.
    if (lang === 'is') {
      const one = t.shoppingStarters.added(1).replace('1', '');
      const twentyOne = t.shoppingStarters.added(21).replace('21', '');
      const five = t.shoppingStarters.added(5).replace('5', '');
      expect(twentyOne).toBe(one);
      expect(twentyOne).not.toBe(five);
    }
  });
});
