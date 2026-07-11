/**
 * receipt.test.ts — unit tests for lib/receipt.ts (OCR receipt parsing).
 *
 * parseReceiptText turns OCR'd lines into priced items; levenshtein/findFuzzyMatch
 * back the silent Katalog price updates. Pure functions, no mocks.
 */
import { levenshtein, findFuzzyMatch, parseReceiptText } from '@/lib/receipt';

describe('levenshtein', () => {
  it('computes classic edit distances', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
});

describe('findFuzzyMatch', () => {
  it('matches case-insensitively via substring', () => {
    expect(findFuzzyMatch('melk', ['Melk', 'Brød'])).toBe('Melk');
  });
  it('matches a close typo via the edit-distance fallback (no substring match)', () => {
    // 'melok' is not a substring of any candidate, but is 1 edit from 'Melk'.
    expect(findFuzzyMatch('melok', ['Melk', 'Brød'])).toBe('Melk');
  });
  it('returns null when nothing is close enough', () => {
    expect(findFuzzyMatch('xyz', ['Melk', 'Brød'])).toBeNull();
    expect(findFuzzyMatch('', ['Melk'])).toBeNull();
  });
});

describe('parseReceiptText', () => {
  it('keeps priced item lines and strips the price from the name', () => {
    const items = parseReceiptText('Melk 12,50\nBrød 25.00');
    expect(items).toEqual([
      { name: 'Melk', price: 12.5, selected: true },
      { name: 'Brød', price: 25, selected: true },
    ]);
  });
  it('skips totals/payment/metadata and price-less lines', () => {
    const items = parseReceiptText(
      'Melk 12,50\nTotal 37,50\nVisa 37,50\nMva 5,00\nBonuskort\n',
    );
    expect(items).toEqual([{ name: 'Melk', price: 12.5, selected: true }]);
  });
  it('drops lines whose remaining name is too short (< 2 chars)', () => {
    expect(parseReceiptText('A 1,00')).toEqual([]);
  });
  it('returns [] for empty input', () => {
    expect(parseReceiptText('')).toEqual([]);
  });
});
