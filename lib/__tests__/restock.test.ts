/**
 * restock.test.ts — pins lib/restock.ts (what "Make week list from here" ticks for you).
 *
 * Connections:
 *   Imports → lib/restock
 *   Used by → jest
 *   Data    → none
 */
import { isUnderTarget, missingCount, restockIds } from '@/lib/restock';

describe('restock', () => {
  it('under target is wanted, at or over is not', () => {
    expect(isUnderTarget({ inventoryQty: 1, targetQuantity: 3 })).toBe(true);
    expect(isUnderTarget({ inventoryQty: 3, targetQuantity: 3 })).toBe(false);
    expect(isUnderTarget({ inventoryQty: 5, targetQuantity: 3 })).toBe(false);
  });
  it('never counted (0) is wanted — the old take-everything default', () => {
    expect(isUnderTarget({ inventoryQty: 0, targetQuantity: 1 })).toBe(true);
  });
  it('missingCount', () => {
    expect(missingCount({ inventoryQty: 1, targetQuantity: 4 })).toBe(3);
    expect(missingCount({ inventoryQty: 6, targetQuantity: 4 })).toBe(0);
  });
  it('restockIds picks only what is short', () => {
    const ids = restockIds([
      { id: 'a', inventoryQty: 0, targetQuantity: 2 },
      { id: 'b', inventoryQty: 2, targetQuantity: 2 },
      { id: 'c', inventoryQty: 1, targetQuantity: 2 },
    ]);
    expect([...ids].sort()).toEqual(['a', 'c']);
  });
});
