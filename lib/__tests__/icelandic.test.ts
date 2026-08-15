/**
 * icelandic.test.ts — the one grammar rule the Icelandic dictionary carries that the other
 * two do not.
 *
 * `en` and `no` express a count with a bare `n === 1`. Icelandic cannot: a number ending in
 * 1 takes the SINGULAR, except 11, which does not — "21 vara" but "11 vörur". Every counted
 * noun in `is` routes through `isCount` in lib/i18n.ts, and this file pins the boundaries
 * that a hand-written `n === 1` would get wrong (1 vs 11 vs 21 vs 101 vs 111).
 *
 * It is a behavioural test through `getTranslations('is')` rather than a unit test of the
 * helper, because the helper is private and the thing worth protecting is the rendered
 * string. Structural parity between the three dictionaries needs no test at all — `no` and
 * `is` are both typed `typeof en`, so a missing or misspelled key is a compile error.
 */
import { getTranslations } from '@/lib/i18n';

const t = getTranslations('is');

describe('Icelandic count agreement (1 but not 11 takes the singular)', () => {
  test.each([
    [1, 'vara'],
    [2, 'vörur'],
    [4, 'vörur'],
    // 11 is the exception the naive rule gets right by accident and 21 is the one it breaks.
    [11, 'vörur'],
    [21, 'vara'],
    [101, 'vara'],
    [111, 'vörur'],
  ])('%i items reads as "%s"', (n, expected) => {
    expect(t.widgets.itemsLeft(n)).toBe(`${n} ${expected} eftir`);
  });

  test('zero takes the plural', () => {
    expect(t.widgets.itemsLeft(0)).toBe('0 vörur eftir');
  });

  test('habits agree the same way', () => {
    expect(t.widgets.habitsLeft(1)).toBe('1 venja eftir');
    expect(t.widgets.habitsLeft(21)).toBe('21 venja eftir');
    expect(t.widgets.habitsLeft(11)).toBe('11 venjur eftir');
  });

  test('a phrase whose VERB agrees switches whole, not by suffix', () => {
    // "vara fór" / "vörur fóru" — the verb changes too, which is why isCount takes two full
    // forms rather than a stem plus an ending.
    expect(t.itemsAddedToList(1)).toBe('1 vara fór á listann ✓');
    expect(t.itemsAddedToList(3)).toBe('3 vörur fóru á listann ✓');
    expect(t.itemsAddedToList(21)).toBe('21 vara fór á listann ✓');
  });

  test('a noun with one form for both numbers still reads correctly', () => {
    // "verkefni" is the same in singular and plural, so it does NOT go through isCount.
    // Asserted so nobody "fixes" it by inventing a plural that does not exist.
    expect(t.widgets.tasksLeft(1)).toBe('1 verkefni eftir');
    expect(t.widgets.tasksLeft(5)).toBe('5 verkefni eftir');
  });
});

describe('user-supplied text is never dropped into a case slot', () => {
  // Icelandic would want the accusative after these verbs, and an arbitrary task title or
  // person name cannot supply one. Quoting makes it a citation, which takes the nominative.
  test('a delete confirm quotes the name instead of inflecting it', () => {
    expect(t.deleteConfirmTitle('Þvottur')).toBe('Eyða „Þvottur“?');
  });

  test('a person removal quotes the name too', () => {
    expect(t.peopleMode.removeTitle('Anna')).toBe('Fjarlægja „Anna“?');
  });

  test('a toast routes the name around the preposition rather than through it', () => {
    expect(t.itemAddedToNamedList('Mjólk', 'Vikulisti')).toBe('Mjólk → Vikulisti ✓');
  });
});

describe('the dictionary is wired up', () => {
  test('getTranslations("is") returns Icelandic, not the Norwegian fallback', () => {
    expect(t.settingsTitle).toBe('Stillingar');
    expect(t.nav.home).toBe('Heim');
  });

  test('an unknown stored language still falls back to Norwegian', () => {
    // Guards the DICTIONARIES lookup: a settings row written by a newer build must not
    // render `undefined` all over the app.
    expect(getTranslations('fr' as never).settingsTitle).toBe('Innstillinger');
  });
});
