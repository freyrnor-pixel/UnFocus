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
  groupByCategory,
  computeListGroups,
  dishGroupAllChecked,
  listProgress,
  listTotal,
  catalogItemsForList,
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

describe('catalogItemsForList', () => {
  it('returns only status=catalog rows for the given monthlyListId, name-sorted', () => {
    const items = [
      item({ id: 'a', name: 'Zucchini', status: 'catalog', monthlyListId: 'M1' }),
      item({ id: 'b', name: 'Apples', status: 'catalog', monthlyListId: 'M1' }),
      item({ id: 'c', name: 'Bread', status: 'catalog', monthlyListId: 'M2' }),
      item({ id: 'd', name: 'Milk', status: 'inWeeklyList', monthlyListId: 'M1' }),
    ];
    expect(catalogItemsForList(items, 'M1').map((i) => i.id)).toEqual(['b', 'a']);
    expect(catalogItemsForList(items, 'M2').map((i) => i.id)).toEqual(['c']);
    expect(catalogItemsForList(items, 'M3')).toEqual([]);
  });
});

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

describe('groupByCategory', () => {
  it('buckets by category, sorts groups by key and items by name within a group', () => {
    const items = [
      item({ id: 'a', category: 'dairy', name: 'Milk' }),
      item({ id: 'b', category: 'produce', name: 'Banana' }),
      item({ id: 'c', category: 'produce', name: 'Apple' }),
    ];
    const groups = groupByCategory(items);
    expect(groups.map(([key]) => key)).toEqual(['dairy', 'produce']);
    expect(groups[1][1].map((i) => i.id)).toEqual(['c', 'b']);
  });

  it('defaults a blank/unset category to "other"', () => {
    const items = [item({ id: 'a', category: '' }), item({ id: 'b', category: undefined })];
    const groups = groupByCategory(items);
    expect(groups).toEqual([['other', [items[0], items[1]]]]);
  });

  it('returns an empty array for an empty input', () => {
    expect(groupByCategory([])).toEqual([]);
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

// ── The third section (2026-08-11) ───────────────────────────────────────────

describe('computeListGroups — the Kjøpt bucket', () => {
  it('collects the list’s purchased rows, which the inWeeklyList filter drops', () => {
    // doneShopping() preserves list_id, so these rows still belong to L1 — before this
    // bucket existed they simply had nowhere to be drawn.
    const items = [
      item({ id: 'p1', status: 'purchased', listId: 'L1', purchasedAt: '2026-08-10T09:00:00Z' }),
      item({ id: 'still-here', status: 'inWeeklyList', listId: 'L1' }),
    ];
    const { purchased, ungroupedUnchecked } = computeListGroups(items, 'L1');
    expect(purchased.map((i) => i.id)).toEqual(['p1']);
    expect(ungroupedUnchecked.map((i) => i.id)).toEqual(['still-here']);
  });

  it('scopes to the list, so another list’s purchases never leak in', () => {
    const items = [
      item({ id: 'mine', status: 'purchased', listId: 'L1' }),
      item({ id: 'theirs', status: 'purchased', listId: 'L2' }),
    ];
    expect(computeListGroups(items, 'L1').purchased.map((i) => i.id)).toEqual(['mine']);
  });

  it('sorts newest-bought first, falling back to name when the stamp ties', () => {
    const items = [
      item({ id: 'old', status: 'purchased', purchasedAt: '2026-08-01T09:00:00Z' }),
      item({ id: 'new', status: 'purchased', purchasedAt: '2026-08-09T09:00:00Z' }),
      item({ id: 'tieB', status: 'purchased', purchasedAt: '2026-08-05T09:00:00Z', name: 'B' }),
      item({ id: 'tieA', status: 'purchased', purchasedAt: '2026-08-05T09:00:00Z', name: 'A' }),
    ];
    expect(computeListGroups(items, 'L1').purchased.map((i) => i.id)).toEqual([
      'new',
      'tieA',
      'tieB',
      'old',
    ]);
  });

  it('tolerates a missing purchasedAt instead of throwing', () => {
    // Rows purchased before the stamp existed sort last rather than crashing the section.
    const items = [
      item({ id: 'stamped', status: 'purchased', purchasedAt: '2026-08-09T09:00:00Z' }),
      item({ id: 'unstamped', status: 'purchased', purchasedAt: undefined }),
    ];
    expect(computeListGroups(items, 'L1').purchased.map((i) => i.id)).toEqual([
      'stamped',
      'unstamped',
    ]);
  });

  it('is INERT for progress and totals — a bought row is not part of the trip', () => {
    // The whole point of the additive shape: listProgress/listTotal read the other three
    // keys by name, so adding this bucket must not move either number. If a bought row ever
    // started counting, a finished list would read as permanently in-progress.
    const groups = computeListGroups(
      [
        item({ id: 'todo', status: 'inWeeklyList', checked: false, price: 10, amount: '1' }),
        item({ id: 'cart', status: 'inWeeklyList', checked: true, price: 10, amount: '1' }),
        item({ id: 'bought', status: 'purchased', price: 999, amount: '5' }),
      ],
      'L1'
    );
    expect(groups.purchased).toHaveLength(1);
    expect(listProgress(groups)).toMatchObject({ remaining: 1, inCart: 1, total: 2 });
    expect(listTotal(groups)).toBe(20);
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
