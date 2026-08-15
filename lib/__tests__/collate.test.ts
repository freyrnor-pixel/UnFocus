/**
 * collate.test.ts — lib/collate.ts's locale mapping, and the orders it actually produces.
 *
 * The mapping is three lines, so the interesting half is the second describe: it pins the
 * CONSEQUENCE, that an Icelandic name lands where an Icelandic reader looks for it. A test
 * of `collationLocale` alone would pass with the two locales swapped.
 *
 * Every expectation below was MEASURED against the runtime's ICU, not reasoned about — the
 * first draft of this file asserted þ sorts after æ (it does not; Icelandic runs … þ, æ, ö)
 * and asserted a difference on a pair where the two locales agree.
 */
import { collationLocale, compareNames } from '@/lib/collate';

describe('collationLocale', () => {
  test('Icelandic gets its own collation', () => {
    expect(collationLocale('is')).toBe('is');
  });

  test('Norwegian and English share Norwegian collation', () => {
    // English is NOT 'en' on purpose — the seeded catalogue/dish/symptom names are Norwegian
    // in every language, so an English user is reading a Norwegian list. See collate.ts.
    expect(collationLocale('no')).toBe('no');
    expect(collationLocale('en')).toBe('no');
  });
});

describe('the orders it actually produces', () => {
  const sorted = (names: string[], locale: string) => [...names].sort((a, b) => compareNames(a, b, locale));

  /* ── Where the two locales genuinely differ ─────────────────────────────────────────
     These are the cases that make passing a locale worth anything. Both are everywhere in
     Icelandic: ð is a common medial/final letter, and the acute vowels are ordinary
     spelling, not decoration. Under Norwegian collation both fold into their base letter,
     so the word sorts by its SECOND letter and lands in the wrong run. */

  test('ð is its own letter after d in Icelandic, and folds into d in Norwegian', () => {
    expect(sorted(['Dagur', 'Ðe', 'Dós'], 'is')).toEqual(['Dagur', 'Dós', 'Ðe']);
    expect(sorted(['Dagur', 'Ðe', 'Dós'], 'no')).toEqual(['Dagur', 'Ðe', 'Dós']);
  });

  test('á is its own letter after a in Icelandic, and folds into a in Norwegian', () => {
    // "Áki" after "Ari" in Icelandic (á is a letter of its own); before it in Norwegian,
    // where á is an a and the k/r comparison decides.
    expect(sorted(['Ari', 'Áki'], 'is')).toEqual(['Ari', 'Áki']);
    expect(sorted(['Ari', 'Áki'], 'no')).toEqual(['Áki', 'Ari']);
  });

  /* ── Where they agree, asserted so a future locale change can't quietly break them ── */

  test('Icelandic runs … þ, æ, ö at the end of the alphabet', () => {
    expect(sorted(['Ökuvél', 'Þorskur', 'Sykur', 'Ær'], 'is')).toEqual([
      'Sykur',
      'Þorskur',
      'Ær',
      'Ökuvél',
    ]);
  });

  test('Norwegian still sorts æ, ø, å after z — the behaviour this replaced', () => {
    expect(sorted(['Ål', 'Abbor', 'Ørret', 'Ærfugl'], 'no')).toEqual([
      'Abbor',
      'Ærfugl',
      'Ørret',
      'Ål',
    ]);
  });

  test('compareNames falls back to the store language when no locale is passed', () => {
    // Default settings are Norwegian (lib/db's migration + the store's readEnum default).
    expect(compareNames('Áki', 'Ari')).toBeLessThan(0);
  });
});
