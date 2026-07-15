/**
 * shoppingGroups.test.ts — unit tests for lib/shoppingGroups.ts.
 *
 * Locks in the dish-grouping split that a past regression broke (see the file
 * header's Edit notes): a fully-checked dish must stay inside dishGroups, and
 * listProgress()/listTotal() must count dish items by their own checked state,
 * not by which bucket they land in. Pure functions — no mocks, ShoppingItem is
 * a type-only import so nothing pulls in the SQLite-backed store at runtime.
 */
import type { ShoppingItem } from '@/store/useShoppingStore';
import {
  groupByDish,
  computeListGroups,
  dishGroupAllChecked,
  listProgress,
  listTotal,
} from '@/lib/shoppingGroups';

function item(overrides: Partial<ShoppingItem>): ShoppingItem {
  return {
    id: 'i1',
    name: 'Item',
    amount: '1',
    unit: '',
    price: 0,
    category: '',
    store: '',
    status: 'inWeeklyList',
    listId: 'L1',
    checked: false,
    orderIndex: 0,
    dishName: undefined,
    ...overrides,
  } as ShoppingItem;
}

describe('groupByDish', () => {
  it('buckets by dishName and sorts dish groups alphabetically', () => {
    const items = [
      item({ id: 'a', dishName: 'Tacos' }),
      item({ id: 'b', dishName: 'Bolognese' }),
      item({ id: 'c', dishName: 'Tacos' }),
      item({ id: 'd', dishName: undefined }),
    ];
    const { dishGroups, ungrouped } = groupByDish(items);
    expect(dishGroups.map(([name]) => name)).toEqual(['Bolognese', 'Tacos']);
    expect(dishGroups[1][1].map((i) => i.id)).toEqual(['a', 'c']);
    expect(ungrouped.map((i) => i.id)).toEqual(['d']);
  });

  it('returns empty groups for an empty input', () => {
    expect(groupByDish([])).toEqual({ dishGroups: [], ungrouped: [] });
  });
});

describe('computeListGroups', () => {
  it('only includes inWeeklyList items for the given listId', () => {
    const items = [
      item({ id: 'keep', status: 'inWeeklyList', listId: 'L1' }),
      item({ id: 'wrong-list', status: 'inWeeklyList', listId: 'L2' }),
      item({ id: 'wrong-status', status: 'catalog', listId: 'L1' }),
    ];
    const { ungroupedUnchecked } = computeListGroups(items, 'L1');
    expect(ungroupedUnchecked.map((i) => i.id)).toEqual(['keep']);
  });

  it('keeps a fully-checked dish inside dishGroups (the past-regression case)', () => {
    const items = [
      item({ id: 'x', dishName: 'Tacos', checked: true }),
      item({ id: 'y', dishName: 'Tacos', checked: true }),
    ];
    const { dishGroups, checked } = computeListGroups(items, 'L1');
    expect(dishGroups.map(([name]) => name)).toEqual(['Tacos']);
    // Checked dish items must NOT fall out into the flat `checked` bucket.
    expect(checked).toHaveLength(0);
    expect(dishGroupAllChecked(dishGroups[0][1])).toBe(true);
  });

  it('sorts ungroupedUnchecked by orderIndex and checked by name', () => {
    const items = [
      item({ id: 'u2', checked: false, orderIndex: 2, name: 'B' }),
      item({ id: 'u1', checked: false, orderIndex: 1, name: 'A' }),
      item({ id: 'cZ', checked: true, name: 'Zucchini' }),
      item({ id: 'cA', checked: true, name: 'Apple' }),
    ];
    const { ungroupedUnchecked, checked } = computeListGroups(items, 'L1');
    expect(ungroupedUnchecked.map((i) => i.id)).toEqual(['u1', 'u2']);
    expect(checked.map((i) => i.id)).toEqual(['cA', 'cZ']);
  });
});

describe('dishGroupAllChecked', () => {
  it('is false for an empty group', () => {
    expect(dishGroupAllChecked([])).toBe(false);
  });
  it('is true only when every item is checked', () => {
    expect(dishGroupAllChecked([item({ checked: true }), item({ checked: true })])).toBe(true);
    expect(dishGroupAllChecked([item({ checked: true }), item({ checked: false })])).toBe(false);
  });
});

describe('listProgress', () => {
  it('counts dish items by their own checked state', () => {
    const groups = {
      dishGroups: [
        ['Tacos', [item({ checked: true }), item({ checked: false })]] as [string, ShoppingItem[]],
      ],
      ungroupedUnchecked: [item({ checked: false })],
      checked: [item({ checked: true })],
    };
    // remaining = 1 dish-unchecked + 1 ungrouped = 2; inCart = 1 dish-checked + 1 checked = 2.
    expect(listProgress(groups)).toEqual({ remaining: 2, inCart: 2, total: 4, pct: 0.5 });
  });

  it('has pct 0 for an empty list (no divide-by-zero)', () => {
    expect(listProgress({ dishGroups: [], ungroupedUnchecked: [], checked: [] })).toEqual({
      remaining: 0,
      inCart: 0,
      total: 0,
      pct: 0,
    });
  });
});

describe('listTotal', () => {
  it('sums price × amount across all three buckets, defaulting a blank amount to 1', () => {
    const groups = {
      dishGroups: [['Tacos', [item({ price: 10, amount: '2' })]] as [string, ShoppingItem[]]],
      ungroupedUnchecked: [item({ price: 5, amount: '' })],
      checked: [item({ price: 3, amount: 'not-a-number' })],
    };
    // 10*2 + 5*1 + 3*1 = 28
    expect(listTotal(groups)).toBe(28);
  });
});
