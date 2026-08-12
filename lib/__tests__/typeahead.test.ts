/**
 * typeahead.test.ts — the one suggestion-ordering rule.
 *
 * store/useCatalogStore.ts's and store/useHealthStore.ts's `suggest()` held a byte-identical
 * copy of this comparator until 2026-08-12. Now that there is one, the two properties that
 * would be easy to lose in a later "tidy" are pinned: prefix matches outrank contains
 * matches, and the alphabetical tiebreak is NORWEGIAN — æ/ø/å sort after z, where the
 * default locale would interleave them with a/o.
 */
import { byPrefixThenName } from '@/lib/typeahead';

const sorted = (names: string[], query: string) =>
  [...names.map((name) => ({ name }))].sort(byPrefixThenName(query)).map((x) => x.name);

describe('byPrefixThenName', () => {
  it('puts prefix matches ahead of mid-word matches', () => {
    expect(sorted(['Havremelk', 'Melk', 'Sjokolademelk'], 'melk')).toEqual([
      'Melk',
      'Havremelk',
      'Sjokolademelk',
    ]);
  });

  it('is case-insensitive about the prefix test', () => {
    expect(sorted(['appelsin', 'Eple', 'Ananas'], 'a')).toEqual(['Ananas', 'appelsin', 'Eple']);
  });

  it('sorts ties alphabetically within each group', () => {
    expect(sorted(['Melkesjokolade', 'Melk', 'Melkekartong'], 'melk')).toEqual([
      'Melk',
      'Melkekartong',
      'Melkesjokolade',
    ]);
  });

  // The locale argument is load-bearing: a bare localeCompare() puts "Ærfugl" between A and
  // B, which is wrong in a list a Norwegian user is scanning.
  it('sorts æ, ø and å after z, Norwegian-style', () => {
    expect(sorted(['Ærfugl', 'Zebra', 'Åre', 'Øy'], 'q')).toEqual(['Zebra', 'Ærfugl', 'Øy', 'Åre']);
  });

  it('leaves a list with no matches in alphabetical order', () => {
    expect(sorted(['Banan', 'Agurk'], 'zzz')).toEqual(['Agurk', 'Banan']);
  });
});
