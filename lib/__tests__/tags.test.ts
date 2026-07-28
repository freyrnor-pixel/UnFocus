/**
 * tags.test.ts — the pure tag helpers (2026-07-28, to-do sharing phase 2).
 *
 * lib/tags.ts parses a column that arrives over the wire from another device, so the
 * emphasis here is on TOTALITY (never throws, never returns a duplicate) and on the two
 * decisions that are easy to silently regress: unknown ids survive a parse but are dropped
 * at resolve, and a multi-tag filter is "any of", not "all of".
 */
import {
  parseTagIds,
  serializeTagIds,
  toggleTagId,
  normalizeTagName,
  tagNameKey,
  findTagByName,
  resolveTags,
  matchesTagFilter,
  danglingTagIds,
} from '@/lib/tags';

const tag = (id: string, name: string) => ({ id, name });

describe('parseTagIds', () => {
  it('returns an empty list for every flavour of nothing', () => {
    expect(parseTagIds('')).toEqual([]);
    expect(parseTagIds(null)).toEqual([]);
    expect(parseTagIds(undefined)).toEqual([]);
    expect(parseTagIds('   ')).toEqual([]);
  });

  it('splits, trims, and drops blanks left by stray separators', () => {
    expect(parseTagIds('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseTagIds(' a , b ')).toEqual(['a', 'b']);
    expect(parseTagIds(',a,,b,')).toEqual(['a', 'b']);
  });

  it('de-duplicates, keeping the first occurrence', () => {
    expect(parseTagIds('a,b,a')).toEqual(['a', 'b']);
  });
});

describe('serializeTagIds', () => {
  it('round-trips through parse', () => {
    expect(parseTagIds(serializeTagIds(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('drops blanks and duplicates so the column never grows junk', () => {
    expect(serializeTagIds(['a', '', ' ', 'a', 'b'])).toBe('a,b');
    expect(serializeTagIds([])).toBe('');
  });
});

describe('toggleTagId', () => {
  it('adds when absent and removes when present', () => {
    expect(toggleTagId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleTagId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('preserves the order of the survivors', () => {
    expect(toggleTagId(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('ignores a blank id rather than storing one', () => {
    expect(toggleTagId(['a'], '  ')).toEqual(['a']);
  });
});

describe('name normalisation', () => {
  it('collapses whitespace for display', () => {
    expect(normalizeTagName('  Deep   clean ')).toBe('Deep clean');
  });

  it('matches case- and spacing-insensitively, so one tag stays one tag', () => {
    expect(tagNameKey('Kitchen')).toBe(tagNameKey(' kitchen '));
    expect(tagNameKey('Deep  clean')).toBe(tagNameKey('deep clean'));
  });

  it('finds an existing tag regardless of how it was typed', () => {
    const tags = [tag('1', 'Kitchen'), tag('2', 'Errands')];
    expect(findTagByName(tags, 'kitchen')?.id).toBe('1');
    expect(findTagByName(tags, '  KITCHEN  ')?.id).toBe('1');
    expect(findTagByName(tags, 'Garage')).toBeNull();
    expect(findTagByName(tags, '   ')).toBeNull();
  });
});

describe('resolveTags', () => {
  const tags = [tag('1', 'Kitchen'), tag('2', 'Errands'), tag('3', 'Garden')];

  it('drops ids with no row yet instead of rendering a raw id', () => {
    expect(resolveTags(['1', 'nope', '3'], tags).map((x) => x.id)).toEqual(['1', '3']);
  });

  it('renders in the tag roster order, not the order they were added to the task', () => {
    // Both phones sort tags the same way, so the same set has to draw the same way.
    expect(resolveTags(['3', '1'], tags).map((x) => x.id)).toEqual(['1', '3']);
  });

  it('is empty for an untagged task', () => {
    expect(resolveTags([], tags)).toEqual([]);
  });
});

describe('matchesTagFilter', () => {
  it('matches everything when no tag is selected', () => {
    expect(matchesTagFilter([], [])).toBe(true);
    expect(matchesTagFilter(['a'], [])).toBe(true);
  });

  it('is "any of", not "all of" — a second chip widens the result, never empties it', () => {
    expect(matchesTagFilter(['a'], ['a', 'b'])).toBe(true);
    expect(matchesTagFilter(['b'], ['a', 'b'])).toBe(true);
    expect(matchesTagFilter(['c'], ['a', 'b'])).toBe(false);
  });

  it('excludes an untagged task once any tag is selected', () => {
    expect(matchesTagFilter([], ['a'])).toBe(false);
  });
});

describe('danglingTagIds', () => {
  it('reports only the ids with no matching row', () => {
    const tags = [tag('1', 'Kitchen')];
    expect(danglingTagIds(['1', 'gone'], tags)).toEqual(['gone']);
    expect(danglingTagIds(['1'], tags)).toEqual([]);
  });

  it('is kept separate from resolveTags — display drops unknown ids, storage keeps them', () => {
    const tags = [tag('1', 'Kitchen')];
    // A tag row that simply hasn't synced yet looks identical to a deleted one here,
    // which is exactly why the caller, not this helper, decides whether to erase it.
    expect(resolveTags(['1', 'unsynced'], tags)).toHaveLength(1);
    expect(danglingTagIds(['1', 'unsynced'], tags)).toEqual(['unsynced']);
  });
});
