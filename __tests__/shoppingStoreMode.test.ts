/**
 * shoppingStoreMode.test.ts — the two contracts that outlived store mode itself.
 *
 * ⚠️ **The name is deliberately stale.** components/ShoppingStoreMode.tsx was retired
 * 2026-08-20, when the "In the store" chip layout became the app's single in-store surface
 * (the chips tick in one tap; store mode drew the same list as three worded, reversible
 * sections, and two surfaces for one job was the conflict). The file keeps its name so the
 * history stays findable — same convention as
 * lib/widgets/__tests__/overviewSplit.test.ts. Both contracts below survive the deletion:
 *
 *   1. **`unmarkPurchased()` is a real inverse of `markPurchased()`.** Both are INERT as of
 *      the retirement — store mode was their only caller — but they are kept, not deleted,
 *      because `status='purchased'` is still written by `doneShopping()` (the trip + budget
 *      flow) and a future surface that offers a way back needs this to still be true. Undoing
 *      has to clear `shopping_trip_id` as well as `purchased_at` — a row that is no longer
 *      purchased cannot keep claiming membership in the trip that bought it, or the monthly
 *      reset's `WHERE shopping_trip_id IS NOT NULL` predicate picks it up as though it had
 *      been through a checkout it has been pulled back out of.
 *      It writes through `update()`, so it inherits the live-sync stamp — asserted here,
 *      because `status` is NOT a whitelisted column while `checked` IS, and this transition
 *      moves both.
 *
 *   2. **The keep-awake lock cannot outlive the surface that needs it.** `useKeepAwake()`
 *      acquires on mount and releases on unmount, so it must sit in a component that is
 *      rendered only while the in-store layout is showing. Called at the top level of the
 *      Shopping screen it would run for that screen's whole life and hold the phone awake for
 *      someone who never opened the in-store layout — a battery drain with no visible symptom,
 *      exactly the kind of bug no screenshot and no shape test can catch. The lock moved from
 *      store mode's conditionally-rendered body to components/KeepAwakeInStore.tsx, whose
 *      whole component IS the conditional; the assertions below moved with it. A source scan,
 *      for the same reason lib/__tests__/chromeRhythm.test.ts is one.
 */
import { existsSync, readFileSync } from 'fs';
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

// ── 2. The keep-awake lock is GONE with the layout that needed it ───────────

describe('nothing holds the screen awake any more', () => {
  const strip = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  const screen = strip(
    readFileSync(join(__dirname, '..', 'app', '(tabs)', 'shopping.tsx'), 'utf8')
  );

  // ⚠️ **Rewritten 2026-09-01.** This block used to assert that `components/KeepAwakeInStore.tsx`
  // held `useKeepAwake()` exactly once, rendered null, and was mounted CONDITIONALLY on
  // `layoutSpec.chips` — because a lock acquired at the top level of a co-mounted tab is held for
  // the life of the app.
  //   That whole apparatus went with the "In the store" layout, which went with the per-surface
  // layout picker, which the maintainer asked to delete along with Shopping's "how things look"
  // header button. `chips` was the flag, `inStore` was its only carrier, and the picker was its
  // only entry point — so all four are deleted rather than left unreachable.
  //   The assertions are inverted rather than dropped, and that is the point: the original bug
  // here was a battery drain with no visible symptom, which no screenshot and no shape test can
  // catch. If a keep-awake ever comes back it must come back deliberately, in a component that
  // unmounts, not by someone adding a hook call to the screen.

  it('store mode is gone, so nothing can quietly re-mount its copy of the lock', () => {
    expect(existsSync(join(__dirname, '..', 'components', 'ShoppingStoreMode.tsx'))).toBe(false);
  });

  it('the holder component is deleted too', () => {
    expect(existsSync(join(__dirname, '..', 'components', 'KeepAwakeInStore.tsx'))).toBe(false);
  });

  it('the Shopping screen never calls the hook itself', () => {
    // Unchanged and still the load-bearing one: at the top level of the screen the lock would be
    // held for the life of the tab, which on a co-mounted pager (lazy: false) is the life of the
    // app.
    expect(screen).not.toMatch(/useKeepAwake/);
  });
});
