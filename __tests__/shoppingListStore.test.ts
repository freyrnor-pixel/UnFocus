/**
 * shoppingListStore.test.ts — unit tests for useShoppingListStore's
 * advanceRecurringLists() return contract.
 *
 * Shopping's focus effect (app/(tabs)/shopping.tsx) only re-runs the expensive
 * useShoppingStore.load() when advanceRecurringLists() reports it actually rolled a
 * list forward, so a no-op focus doesn't reflow the list after paint. This locks in
 * that boolean: false when nothing is overdue, true when a list is regenerated.
 *
 * The store imports the SQLite handle at top level, so we mock '@/lib/db' to stay
 * headless (no native SQLite). getAllSync returns [] so copyOpenItemsToList copies
 * nothing; runSync/insert are no-ops we don't assert on here.
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

import { useShoppingListStore, ShoppingList } from '@/store/useShoppingListStore';

const TODAY = '2026-07-15';

function makeList(overrides: Partial<ShoppingList>): ShoppingList {
  return {
    id: 'l1',
    name: 'Test',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    isRecurring: false,
    recurrenceIntervalWeeks: 1,
    activeWeeks: [],
    isCustomName: false,
    isTemplate: false,
    locked: false,
    sortOrder: 0,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('advanceRecurringLists return contract', () => {
  afterEach(() => {
    useShoppingListStore.setState({ lists: [] });
  });

  it('returns false when there are no lists', () => {
    useShoppingListStore.setState({ lists: [] });
    expect(useShoppingListStore.getState().advanceRecurringLists(TODAY)).toBe(false);
  });

  it('returns false when the only overdue list is non-recurring', () => {
    useShoppingListStore.setState({
      lists: [makeList({ isRecurring: false, endDate: '2026-06-07' })],
    });
    expect(useShoppingListStore.getState().advanceRecurringLists(TODAY)).toBe(false);
  });

  it('returns false when a recurring list is still current (not overdue)', () => {
    useShoppingListStore.setState({
      lists: [makeList({ isRecurring: true, endDate: '2026-07-20' })],
    });
    expect(useShoppingListStore.getState().advanceRecurringLists(TODAY)).toBe(false);
  });

  it('returns true when it rolls an overdue recurring list forward', () => {
    useShoppingListStore.setState({
      lists: [makeList({ isRecurring: true, endDate: '2026-06-07', activeWeeks: [] })],
    });
    expect(useShoppingListStore.getState().advanceRecurringLists(TODAY)).toBe(true);
    // It should have inserted a fresh (newer) list rather than mutating the old one.
    expect(useShoppingListStore.getState().lists.length).toBe(2);
  });
});
