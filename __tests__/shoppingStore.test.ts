/**
 * shoppingStore.test.ts — unit tests for the lifecycle transitions in
 * store/useShoppingStore.ts: doneShopping(), monthlyReset(), resetMonthlyList()
 * (Shopping — Monthly redesign, 2026-07-22), restoreDeleted(), and add()'s
 * monthlyListId-scoped catalog dedupe.
 *
 * These mirror their raw-SQL bulk transitions into the in-memory `items` list via
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
        item({ id: 'purchased', status: 'purchased', shoppingTripId: 't1', listId: 'L1', pendingRestock: true }),
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

    // Every item reverted to 'catalog' must not carry a stale listId (2026-07-20 fix) —
    // "Items never carry listId once status='catalog'" per this store's own invariant.
    expect(items.filter((i) => i.status === 'catalog').every((i) => i.listId === undefined)).toBe(
      true
    );

    // Permanent catalog item survives, only its pendingRestock is cleared.
    const perm = items.find((i) => i.id === 'perm')!;
    expect(perm.status).toBe('catalog');
    expect(perm.pendingRestock).toBe(false);

    // All trips deleted.
    expect(useShoppingStore.getState().trips).toHaveLength(0);
  });
});

describe('resetMonthlyList (Shopping — Monthly redesign, 2026-07-22)', () => {
  it("only reverts the given list's items, leaves other lists' items and ALL trips untouched", () => {
    useShoppingStore.setState({
      items: [
        item({ id: 'a-purchased', status: 'purchased', shoppingTripId: 't1', listId: 'W1', monthlyListId: 'M1', pendingRestock: true }),
        item({ id: 'a-temp', status: 'catalog', isTemporary: true, monthlyListId: 'M1' }),
        item({ id: 'a-week', status: 'inWeeklyList', listId: 'W1', monthlyListId: 'M1' }),
        item({ id: 'a-perm', status: 'catalog', pendingRestock: true, monthlyListId: 'M1' }),
        // Different Monthly list — must be completely untouched by resetting M1.
        item({ id: 'b-purchased', status: 'purchased', shoppingTripId: 't1', listId: 'W1', monthlyListId: 'M2' }),
        item({ id: 'b-perm', status: 'catalog', pendingRestock: true, monthlyListId: 'M2' }),
      ],
      trips: [{ id: 't1', completedAt: 'x', label: 'L', monthResetDate: 1, listId: 'W1' }],
    });

    useShoppingStore.getState().resetMonthlyList('M1');
    const items = useShoppingStore.getState().items;

    expect(items.find((i) => i.id === 'a-temp')).toBeUndefined();
    const aPurchased = items.find((i) => i.id === 'a-purchased')!;
    expect(aPurchased.status).toBe('catalog');
    expect(aPurchased.shoppingTripId).toBeUndefined();
    expect(aPurchased.pendingRestock).toBe(false);
    expect(items.find((i) => i.id === 'a-week')!.status).toBe('catalog');
    expect(items.find((i) => i.id === 'a-perm')!.pendingRestock).toBe(false);

    // M2's items are exactly as they started — a per-list reset must not leak across lists.
    const bPurchased = items.find((i) => i.id === 'b-purchased')!;
    expect(bPurchased.status).toBe('purchased');
    expect(bPurchased.shoppingTripId).toBe('t1');
    expect(items.find((i) => i.id === 'b-perm')!.pendingRestock).toBe(true);

    // Unlike monthlyReset(), a per-list reset never deletes shopping_trips — a trip can hold
    // items from several Monthly lists at once (M2's item is still checked out against it).
    expect(useShoppingStore.getState().trips).toHaveLength(1);
  });
});

describe('add — catalog dedupe is scoped by monthlyListId (2026-07-22)', () => {
  it('does not merge same-named catalog items across two different Monthly lists', () => {
    useShoppingStore.setState({ items: [], trips: [] });
    const input = { name: 'Milk', amount: '1', unit: '', listType: 'monthly', store: '', price: 0, inventoryQty: 0, status: 'catalog' as const, targetQuantity: 1 };

    const idA = useShoppingStore.getState().add({ ...input, monthlyListId: 'M1' });
    const idB = useShoppingStore.getState().add({ ...input, monthlyListId: 'M2' });

    expect(idA).not.toBe(idB);
    const items = useShoppingStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id === idA)!.monthlyListId).toBe('M1');
    expect(items.find((i) => i.id === idB)!.monthlyListId).toBe('M2');
  });

  it('still merges (increments targetQuantity) for the same name within the SAME Monthly list', () => {
    useShoppingStore.setState({ items: [], trips: [] });
    const input = { name: 'Milk', amount: '1', unit: '', listType: 'monthly', store: '', price: 0, inventoryQty: 0, status: 'catalog' as const, targetQuantity: 1, monthlyListId: 'M1' };

    const idA = useShoppingStore.getState().add(input);
    const idB = useShoppingStore.getState().add(input);

    expect(idA).toBe(idB);
    const items = useShoppingStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].targetQuantity).toBe(2);
  });
});

describe('restoreDeleted', () => {
  it('resurrects a snapshot that is missing from items (undoes a soft-delete)', () => {
    useShoppingStore.setState({ items: [], trips: [] });
    const snapshot = item({ id: 'gone', name: 'Milk', status: 'inWeeklyList', listId: 'L1', checked: true });

    useShoppingStore.getState().restoreDeleted(snapshot);

    const items = useShoppingStore.getState().items;
    expect(items.find((i) => i.id === 'gone')).toEqual(snapshot);
  });

  it('is a no-op on the in-memory list for a row that never left it', () => {
    const present = item({ id: 'still-here', status: 'inWeeklyList', listId: 'L1' });
    useShoppingStore.setState({ items: [present], trips: [] });

    useShoppingStore.getState().restoreDeleted(present);

    expect(useShoppingStore.getState().items).toEqual([present]);
  });
});
