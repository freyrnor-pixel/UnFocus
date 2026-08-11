/**
 * shoppingStoreMode.test.ts — store mode's two load-bearing contracts (2026-08-11).
 *
 *   1. **`unmarkPurchased()` is a real inverse of `markPurchased()`.** Store mode's third
 *      section ("Kjøpt") has a back button, so "bought" must not be a one-way door. Undoing
 *      has to clear `shopping_trip_id` as well as `purchased_at` — a row that is no longer
 *      purchased cannot keep claiming membership in the trip that bought it, or the monthly
 *      reset's `WHERE shopping_trip_id IS NOT NULL` predicate picks it up as though it had
 *      been through a checkout it has been pulled back out of.
 *      It writes through `update()`, so it inherits the live-sync stamp — asserted here,
 *      because `status` is NOT a whitelisted column while `checked` IS, and this transition
 *      moves both.
 *
 *   2. **The keep-awake lock cannot outlive the mode.** `useKeepAwake()` acquires on mount
 *      and releases on unmount, so it must sit in a body that is rendered only while store
 *      mode is open. Called at the top level of the exported component it would run for the
 *      whole life of the Shopping screen and hold the screen awake for someone who never
 *      opened store mode — a battery drain with no visible symptom, which is exactly the
 *      kind of bug no screenshot and no shape test can catch. A source scan for the same
 *      reason lib/__tests__/chromeRhythm.test.ts is one.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { useShoppingStore, ShoppingItem } from '@/store/useShoppingStore';

const mockTouchRow = jest.fn();
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
  softDelete: jest.fn(),
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

beforeEach(() => {
  mockTouchRow.mockClear();
  mockBroadcastRow.mockClear();
  useShoppingStore.setState({ items: [], trips: [] });
});

// ── 1. The bought ⇄ cart round trip ──────────────────────────────────────────

describe('unmarkPurchased', () => {
  it('puts a bought row back in the CART, not back in the list', () => {
    // The row was in the cart immediately before it was bought, so that is where undoing
    // lands it. Dropping it to the unchecked list would silently discard the fact that the
    // user had already picked the thing up.
    useShoppingStore.setState({
      items: [item({ id: 'x', status: 'purchased', listId: 'L1', purchasedAt: '2026-08-11T10:00:00Z' })],
      trips: [],
    });

    useShoppingStore.getState().unmarkPurchased('x');

    const row = useShoppingStore.getState().items.find((i) => i.id === 'x')!;
    expect(row.status).toBe('inWeeklyList');
    expect(row.checked).toBe(true);
  });

  it('clears BOTH stamps, so the row stops claiming its old trip', () => {
    useShoppingStore.setState({
      items: [
        item({
          id: 'x',
          status: 'purchased',
          listId: 'L1',
          purchasedAt: '2026-08-11T10:00:00Z',
          shoppingTripId: 'T1',
        }),
      ],
      trips: [],
    });

    useShoppingStore.getState().unmarkPurchased('x');

    const row = useShoppingStore.getState().items.find((i) => i.id === 'x')!;
    expect(row.purchasedAt).toBeUndefined();
    // Left set, monthlyReset()'s `WHERE shopping_trip_id IS NOT NULL` would treat this row
    // as having been through a checkout it was pulled back out of.
    expect(row.shoppingTripId).toBeUndefined();
  });

  it('announces the row, since it moves the synced `checked` column', () => {
    useShoppingStore.setState({
      items: [item({ id: 'x', status: 'purchased', listId: 'L1' })],
      trips: [],
    });

    useShoppingStore.getState().unmarkPurchased('x');

    expect(mockTouchRow.mock.calls.filter((c) => c[0] === 'shopping_items').map((c) => c[1])).toEqual(['x']);
    expect(mockBroadcastRow.mock.calls.filter((c) => c[0] === 'shopping_items').map((c) => c[1])).toEqual(['x']);
  });

  it('round-trips with markPurchased', () => {
    useShoppingStore.setState({
      items: [item({ id: 'x', status: 'inWeeklyList', listId: 'L1', checked: true })],
      trips: [],
    });
    const store = useShoppingStore.getState();

    store.markPurchased('x');
    expect(useShoppingStore.getState().items[0].status).toBe('purchased');

    store.unmarkPurchased('x');
    const row = useShoppingStore.getState().items[0];
    expect(row.status).toBe('inWeeklyList');
    expect(row.checked).toBe(true);
  });

  it('is a no-op for an unknown id rather than throwing', () => {
    useShoppingStore.setState({ items: [], trips: [] });
    expect(() => useShoppingStore.getState().unmarkPurchased('nope')).not.toThrow();
    expect(mockTouchRow).not.toHaveBeenCalled();
  });
});

// ── 2. The keep-awake lock is scoped to the mode ─────────────────────────────

describe('ShoppingStoreMode — the screen lock cannot outlive the mode', () => {
  const source = readFileSync(
    join(__dirname, '..', 'components', 'ShoppingStoreMode.tsx'),
    'utf8'
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('calls useKeepAwake exactly once', () => {
    expect(source.match(/useKeepAwake\(/g) ?? []).toHaveLength(1);
  });

  it('calls it inside StoreModeBody, not in the exported component', () => {
    const bodyAt = source.indexOf('function StoreModeBody');
    const exportAt = source.indexOf('export default function ShoppingStoreMode');
    const hookAt = source.indexOf('useKeepAwake(', source.indexOf('import'));

    expect(bodyAt).toBeGreaterThan(-1);
    expect(exportAt).toBeGreaterThan(-1);
    // The body is declared before the export, so the hook must land between the two.
    expect(bodyAt).toBeLessThan(exportAt);
    expect(hookAt).toBeGreaterThan(bodyAt);
    expect(hookAt).toBeLessThan(exportAt);
  });

  it('renders that body conditionally, which is what unmounts the lock', () => {
    // `<Modal visible={...}>` alone is not enough — the body has to actually leave the tree.
    expect(source).toMatch(/visible\s*\?\s*\(?\s*<StoreModeBody/);
  });
});
