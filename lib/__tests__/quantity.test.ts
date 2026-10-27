/**
 * quantity.test.ts — pins lib/quantity.ts (unit-aware amount merging) and lib/dishToList.ts.
 *
 * Connections:
 *   Imports → lib/quantity, lib/dishToList
 *   Used by → jest
 *   Data    → none
 */
import { amountToCount, mergeAmounts, parseAmount, unitsCompatible } from '@/lib/quantity';
import { dishToShoppingInputs } from '@/lib/dishToList';
import type { Dish } from '@/store/useMealStore';

describe('parseAmount', () => {
  it.each([
    ['2', 2],
    ['1,5', 1.5],
    ['0.5', 0.5],
    ['½', 0.5],
    ['1½', 1.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['2 pk', 2],
    [' 3 ', 3],
  ])('%s → %s', (raw, n) => expect(parseAmount(raw)).toBeCloseTo(n));

  it.each(['', 'litt', '0', '1/0'])('%s → null', (raw) => expect(parseAmount(raw)).toBeNull());
});

describe('unitsCompatible', () => {
  it('same family converts, different families do not', () => {
    expect(unitsCompatible('l', 'dl')).toBe(true);
    expect(unitsCompatible('kg', 'g')).toBe(true);
    expect(unitsCompatible('', 'stk')).toBe(true);
    expect(unitsCompatible('Stk.', 'stk')).toBe(true);
    expect(unitsCompatible('stk', 'g')).toBe(false);
    expect(unitsCompatible('l', 'kg')).toBe(false);
    expect(unitsCompatible('boks', 'pk')).toBe(false);
    expect(unitsCompatible('boks', 'Boks')).toBe(true);
  });
});

describe('mergeAmounts', () => {
  it('converts into the existing row unit (the reported bug: 1 l + 5 dl was 6 l)', () => {
    expect(mergeAmounts({ amount: '1', unit: 'l' }, { amount: '5', unit: 'dl' })).toEqual({ amount: '1.5', unit: 'l' });
  });
  it('keeps decimals and the comma the user typed', () => {
    expect(mergeAmounts({ amount: '0,5', unit: 'kg' }, { amount: '250', unit: 'g' })).toEqual({ amount: '0,75', unit: 'kg' });
  });
  it('a bare row counts as 1, as before', () => {
    expect(mergeAmounts({ amount: '', unit: '' }, { amount: '', unit: '' })).toEqual({ amount: '2', unit: '' });
  });
  it('refuses units that cannot be added', () => {
    expect(mergeAmounts({ amount: '2', unit: 'stk' }, { amount: '500', unit: 'g' })).toBeNull();
  });
});

describe('amountToCount', () => {
  it('rounds to a whole count of at least 1', () => {
    expect(amountToCount('1,5')).toBe(2);
    expect(amountToCount('0.2')).toBe(1);
    expect(amountToCount('')).toBe(1);
    expect(amountToCount('4')).toBe(4);
  });
});

describe('dishToShoppingInputs', () => {
  const dish: Dish = {
    id: 'd1',
    name: 'Taco',
    mealType: 'dinner',
    difficulty: 'easy',
    estimatedPriceNok: 0,
    ingredients: [
      { id: 'i1', dishId: 'd1', name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 50 },
      { id: 'i2', dishId: 'd1', name: 'Tomat', amount: '', unit: '', priceNok: 0 },
    ],
  };
  it('weekly: keeps amount + unit, sets list and dish', () => {
    const rows = dishToShoppingInputs(dish, { mode: 'weekly', listId: 'w1' });
    expect(rows[0]).toMatchObject({ name: 'Kjøttdeig', amount: '400', unit: 'g', status: 'inWeeklyList', listId: 'w1', dishName: 'Taco' });
    expect(rows[1].amount).toBe('1');
  });
  it('monthly: catalog row with a whole targetQuantity', () => {
    const rows = dishToShoppingInputs(dish, { mode: 'monthly', listId: 'm1' });
    expect(rows[0]).toMatchObject({ status: 'catalog', amount: '1', targetQuantity: 400, monthlyListId: 'm1' });
    expect(rows[1].targetQuantity).toBe(1);
  });
});
