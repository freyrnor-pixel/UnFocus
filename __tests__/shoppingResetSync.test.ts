/**
 * shoppingResetSync.test.ts — the bulk shopping transitions must ANNOUNCE the synced
 * columns they change (2026-08-10).
 *
 * `doneShopping()`, `monthlyReset()` and `resetMonthlyList()` are the three writes in
 * store/useShoppingStore.ts that move many rows at once with raw SQL instead of going
 * through `update()`. That store's header used to justify skipping the live-sync stamp
 * with "they bypass update() and don't write whitelisted columns anyway" — which was
 * false: all three set `checked = 0`, and the two resets also set `list_id = NULL`, and
 * BOTH of those columns are in lib/liveSync's `shopping_items` whitelist.
 *
 * Left unstamped, the reset is silently undone in a paired household:
 *   1. Phone A resets. `checked`/`list_id` change locally; `updated_at` does NOT move and
 *      nothing is broadcast, so Phone B never hears about it.
 *   2. Phone B still holds the pre-reset row. Its next edit of that item — any field —
 *      stamps a NOW timestamp and `buildDelta` ships a FULL-ROW snapshot of every
 *      whitelisted column, carrying B's stale `checked`/`list_id` along with it.
 *   3. A applies it under LWW (newer timestamp) and the item is back in last month's
 *      list, still checked. The monthly reset reverts itself, every month.
 * Even with no edit on B, an equal `updated_at` falls through to `incomingWins`' origin-
 * device-id tiebreak, so B wins outright whenever its device id sorts higher.
 *
 * The temporary-item purge had the matching hole: a hard `DELETE` leaves no tombstone,
 * and `applyDelta` upserts an unknown id, so B's copy re-inserts the row on A.
 *
 * These tests assert the stamp/broadcast contract at the seam, plus the LWW consequence
 * that makes it matter.
 */
import { useShoppingStore, ShoppingItem } from '@/store/useShoppingStore';
import { incomingWins } from '@/lib/liveSync';

const mockTouchRow = jest.fn();
const mockSoftDelete = jest.fn();
const mockBroadcastRow = jest.fn();

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
jest.mock('@/lib/liveSync', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/liveSync'),
  touchRow: (...a: unknown[]) => mockTouchRow(...a),
  softDelete: (...a: unknown[]) => mockSoftDelete(...a),
}));
jest.mock('@/lib/syncService', () => ({
  __esModule: true,
  broadcastRow: (...a: unknown[]) => mockBroadcastRow(...a),
  startSync: jest.fn(),
  stopSync: jest.fn(),
  isSyncAvailable: jest.fn(() => false),
}));

function item(overrides: Partial<ShoppingItem>): ShoppingItem {
  return {
    id: 'i1', name: 'Item', amount: '1', unit: '', price: 0, targetQuantity: 0,
    isTemporary: false, pendingRestock: false, checked: false, collected: false,
    fromCatalog: false, inventoryQty: 0, status: 'catalog',
    ...overrides,
  } as ShoppingItem;
}

/** Ids passed to touchRow/broadcastRow for the shopping_items table. */
const announced = () => ({
  stamped: mockTouchRow.mock.calls.filter((c) => c[0] === 'shopping_items').map((c) => c[1]).sort(),
  broadcast: mockBroadcastRow.mock.calls.filter((c) => c[0] === 'shopping_items').map((c) => c[1]).sort(),
});

beforeEach(() => {
  mockTouchRow.mockClear();
  mockSoftDelete.mockClear();
  mockBroadcastRow.mockClear();
  useShoppingStore.setState({ items: [], trips: [] });
});

describe('monthlyReset announces the rows it changes', () => {
  it('stamps and broadcasts every item whose checked/list_id it cleared', () => {
    useShoppingStore.setState({
      items: [
        item({ id: 'a', status: 'inWeeklyList', listId: 'L1', checked: true }),
        item({ id: 'b', status: 'purchased', shoppingTripId: 'T1', checked: true, listId: 'L1' }),
        item({ id: 'c', status: 'catalog' }), // untouched — nothing synced changed
      ],
      trips: [],
    });

    useShoppingStore.getState().monthlyReset();

    const { stamped, broadcast } = announced();
    expect(stamped).toEqual(['a', 'b']);
    expect(broadcast).toEqual(['a', 'b']);
  });

  it('tombstones purged temporary items instead of hard-deleting them', () => {
    useShoppingStore.setState({
      items: [item({ id: 'tmp', status: 'inWeeklyList', listId: 'L1', isTemporary: true })],
      trips: [],
    });

    useShoppingStore.getState().monthlyReset();

    expect(mockSoftDelete.mock.calls.map((c) => [c[0], c[1]])).toContainEqual(['shopping_items', 'tmp']);
    expect(mockBroadcastRow.mock.calls.map((c) => c[1])).toContain('tmp');
  });
});

describe('resetMonthlyList announces the rows it changes', () => {
  it('stamps and broadcasts only its own list', () => {
    useShoppingStore.setState({
      items: [
        item({ id: 'a', status: 'inWeeklyList', listId: 'L1', checked: true, monthlyListId: 'M1' }),
        item({ id: 'b', status: 'inWeeklyList', listId: 'L1', checked: true, monthlyListId: 'M2' }),
      ],
      trips: [],
    });

    useShoppingStore.getState().resetMonthlyList('M1');

    const { stamped, broadcast } = announced();
    expect(stamped).toEqual(['a']);
    expect(broadcast).toEqual(['a']);
  });
});

describe('doneShopping announces the rows it changes', () => {
  it('stamps and broadcasts the items it unchecked', () => {
    useShoppingStore.setState({
      items: [
        item({ id: 'a', status: 'inWeeklyList', listId: 'L1', checked: true }),
        item({ id: 'b', status: 'inWeeklyList', listId: 'L2', checked: true }), // other list
      ],
      trips: [],
    });

    useShoppingStore.getState().doneShopping('L1', 'Trip', 1);

    const { stamped, broadcast } = announced();
    expect(stamped).toEqual(['a']);
    expect(broadcast).toEqual(['a']);
  });
});

describe('why the stamp matters (LWW consequence)', () => {
  it("an unstamped reset loses to a peer's later full-row snapshot", () => {
    // A resets at T1 but never moves updated_at; B edits the same row afterwards.
    const aAfterUnstampedReset = { updatedAt: '2026-08-01T09:00:00.000Z', originDeviceId: 'devA' };
    const bLaterEdit = { updatedAt: '2026-08-01T09:05:00.000Z', originDeviceId: 'devB' };
    expect(incomingWins(aAfterUnstampedReset, bLaterEdit)).toBe(true);
  });

  it('an unstamped reset can lose on the device-id tiebreak with no peer edit at all', () => {
    const equal = '2026-08-01T09:00:00.000Z';
    expect(incomingWins({ updatedAt: equal, originDeviceId: 'devA' }, { updatedAt: equal, originDeviceId: 'devB' })).toBe(true);
  });

  it('a stamped reset wins against the same stale peer row', () => {
    const aStampedReset = { updatedAt: '2026-08-01T09:10:00.000Z', originDeviceId: 'devA' };
    const bStaleRow = { updatedAt: '2026-08-01T09:00:00.000Z', originDeviceId: 'devB' };
    expect(incomingWins(aStampedReset, bStaleRow)).toBe(false);
  });
});
