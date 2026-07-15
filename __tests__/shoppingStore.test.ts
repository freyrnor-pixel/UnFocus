/**
 * shoppingStore.test.ts — unit tests for the two lifecycle transitions in
 * store/useShoppingStore.ts: doneShopping() and monthlyReset().
 *
 * Both mirror their raw-SQL bulk transitions into the in-memory `items` list via
 * set(), so a no-op '@/lib/db' mock lets the JS state-machine be asserted without
 * a real database. State is seeded with setState directly.
 */
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));

import { useShoppingStore, ShoppingItem } from '@/store/useShoppingStore';

function item(overrides: Partial<ShoppingItem>): ShoppingItem {
  return {
    id: 'i1',
    name: 'Item',
    amount: '1',
    unit: '',
    price: 0,
    targetQuantity: 0,
    isTemporary: false,
    pendingRestock: false,
    checked: false,
    collected: false,
    fromCatalog: false,
    inventoryQty: 0,
    status: 'catalog',
    ...overrides,
  } as ShoppingItem;
}

afterEach(() => useShoppingStore.setState({ items: [], trips: [] }));

describe('doneShopping', () => {
  it("marks only the given list's inWeeklyList items purchased and records a trip", () => {
    useShoppingStore.setState({
      items: [
        item({ id: 'a', status: 'inWeeklyList', listId: 'L1', checked: true }),
        item({ id: 'b', status: 'inWeeklyList', listId: 'L2' }), // other list — untouched
        item({ id: 'c', status: 'catalog', listId: 'L1' }), // not in a week list — untouched
      ],
      trips: [],
    });

    const tripId = useShoppingStore.getState().doneShopping('L1', 'Weekly', 1);
    expect(typeof tripId).toBe('string');

    const items = useShoppingStore.getState().items;
    const a = items.find((i) => i.id === 'a')!;
    expect(a.status).toBe('purchased');
    expect(a.shoppingTripId).toBe(tripId);
    expect(a.checked).toBe(false); // reset on checkout
    expect(items.find((i) => i.id === 'b')!.status).toBe('inWeeklyList');
    expect(items.find((i) => i.id === 'c')!.status).toBe('catalog');

    expect(useShoppingStore.getState().trips).toHaveLength(1);
    expect(useShoppingStore.getState().trips[0].id).toBe(tripId);
  });
});

describe('monthlyReset', () => {
  it('reverts purchased/week items to catalog, drops temporaries, clears flags and trips', () => {
    useShoppingStore.setState({
      items: [
        item({ id: 'purchased', status: 'purchased', shoppingTripId: 't1', pendingRestock: true }),
        item({ id: 'temp', status: 'catalog', isTemporary: true }),
        item({ id: 'week', status: 'inWeeklyList', listId: 'L1' }),
        item({ id: 'perm', status: 'catalog', pendingRestock: true }),
      ],
      trips: [{ id: 't1', completedAt: 'x', label: 'L', monthResetDate: 1, listId: 'L1' }],
    });

    useShoppingStore.getState().monthlyReset();
    const items = useShoppingStore.getState().items;

    // Temporary item is gone entirely.
    expect(items.find((i) => i.id === 'temp')).toBeUndefined();

    // Purchased + week items revert to catalog with flags cleared.
    const purchased = items.find((i) => i.id === 'purchased')!;
    expect(purchased.status).toBe('catalog');
    expect(purchased.shoppingTripId).toBeUndefined();
    expect(purchased.pendingRestock).toBe(false);
    expect(items.find((i) => i.id === 'week')!.status).toBe('catalog');

    // Permanent catalog item survives, only its pendingRestock is cleared.
    const perm = items.find((i) => i.id === 'perm')!;
    expect(perm.status).toBe('catalog');
    expect(perm.pendingRestock).toBe(false);

    // All trips deleted.
    expect(useShoppingStore.getState().trips).toHaveLength(0);
  });
});
