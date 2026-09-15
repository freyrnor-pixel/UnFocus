/**
 * reorder.test.ts — drag-reorder insertion math, incl. the anti-flicker regression guard,
 * plus the order-projection helpers that replaced seven hand-written O(n²) expressions.
 */
import { computeReorderInsertIndex, projectOrder, reorderByDrag, retainKnownIds, RowSnapshot } from '@/lib/reorder';

// Three 50px rows stacked from y=0: A[0..50] B[50..100] C[100..150], centers 25/75/125.
const SNAP: Record<string, RowSnapshot> = {
  A: { y: 0, height: 50 },
  B: { y: 50, height: 50 },
  C: { y: 100, height: 50 },
};
const ORDER = ['A', 'B', 'C'];

describe('computeReorderInsertIndex', () => {
  it('excludes the dragged row and counts rows the finger has passed', () => {
    // Dragging A: above B's center (75) → slot 0; past B's center → slot 1; past C's center → slot 2.
    expect(computeReorderInsertIndex(10, ORDER, 'A', SNAP)).toBe(0);
    expect(computeReorderInsertIndex(74, ORDER, 'A', SNAP)).toBe(0);
    expect(computeReorderInsertIndex(76, ORDER, 'A', SNAP)).toBe(1);
    expect(computeReorderInsertIndex(130, ORDER, 'A', SNAP)).toBe(2);
  });

  it('ignores rows missing from the snapshot', () => {
    expect(computeReorderInsertIndex(200, ORDER, 'A', { B: { y: 50, height: 50 } })).toBe(1);
  });

  it('is a stable step function of finger position regardless of the live order (no oscillation)', () => {
    // The flicker bug: once A swapped past B the boundary moved back under the finger and the
    // row bounced between orders. Here the insertion index depends ONLY on centerY + the static
    // snapshot, so feeding the *already-reordered* live order at the same finger position yields
    // the same index — the drag settles instead of flickering.
    const centerY = 76;
    const first = reorderByDrag(centerY, ORDER, 'A', SNAP); // ['B','A','C']
    expect(first).toEqual(['B', 'A', 'C']);
    // Re-run at the same finger position with the new live order — must be a fixed point.
    const second = reorderByDrag(centerY, first, 'A', SNAP);
    expect(second).toEqual(first);
    const third = reorderByDrag(centerY, second, 'A', SNAP);
    expect(third).toEqual(first);
  });

  it('reorderByDrag keeps non-dragged rows in their original relative order', () => {
    // Dragging B to the top shouldn't disturb A vs C.
    expect(reorderByDrag(5, ORDER, 'B', SNAP)).toEqual(['B', 'A', 'C']);
    // Dragging B to the bottom.
    expect(reorderByDrag(130, ORDER, 'B', SNAP)).toEqual(['A', 'C', 'B']);
  });
});

/**
 * `projectOrder` / `retainKnownIds` replaced seven copies of two expressions. The ONLY thing
 * that may change is the cost, so these tests are written as differential tests against the
 * exact code they replaced, rather than as assertions about what the new helper "should" do.
 * If the reference and the helper ever disagree, the helper is wrong — that is the whole
 * contract, and it is why the old expressions are reproduced here verbatim instead of being
 * described in prose.
 */
describe('projectOrder — the O(n) replacement for orderedIds.map(id => items.find(...))', () => {
  type Row = { id: string; name: string };
  /** Verbatim the expression at the seven call sites, kept as the oracle. */
  const reference = (ids: string[], items: Row[]): Row[] =>
    ids.map((id) => items.find((x) => x.id === id)).filter((x): x is Row => !!x);

  const ROWS: Row[] = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Gamma' },
  ];

  const CASES: [string, string[], Row[]][] = [
    ['the identity order', ['a', 'b', 'c'], ROWS],
    ['a reordered list', ['c', 'a', 'b'], ROWS],
    ['an id with no row (deleted mid-drag)', ['a', 'ghost', 'c'], ROWS],
    ['every id missing', ['x', 'y'], ROWS],
    ['an empty order', [], ROWS],
    ['an empty item list', ['a', 'b'], []],
    ['a partial order — rows not named are not returned', ['b'], ROWS],
    ['a duplicated id', ['a', 'a', 'b'], ROWS],
    ['both empty', [], []],
  ];

  it.each(CASES)('matches the old expression exactly: %s', (_label, ids, items) => {
    expect(projectOrder(ids, items)).toEqual(reference(ids, items));
  });

  it('returns the SAME object references, not copies', () => {
    // Callers pass these straight into row components; a fresh object every render would
    // defeat every downstream memo and turn a cost fix into a cost.
    const out = projectOrder(['b', 'a'], ROWS);
    expect(out[0]).toBe(ROWS[1]);
    expect(out[1]).toBe(ROWS[0]);
  });

  it('keeps the LAST row when two share an id, like Map construction does', () => {
    // Not a case the app should produce, but the old `.find()` kept the FIRST. Pinned so the
    // difference is a decision on record rather than a surprise: ids are unique by construction
    // (SQLite primary keys), so no call site can distinguish them.
    const dupes: Row[] = [{ id: 'a', name: 'first' }, { id: 'a', name: 'second' }];
    expect(projectOrder(['a'], dupes)).toEqual([{ id: 'a', name: 'second' }]);
    expect(reference(['a'], dupes)).toEqual([{ id: 'a', name: 'first' }]);
  });
});

describe('retainKnownIds — the O(n) replacement for ids.filter(id => rows.some(...))', () => {
  type Row = { id: string };
  const reference = (ids: string[], items: Row[]): string[] =>
    ids.filter((id) => items.some((r) => r.id === id));

  const ROWS: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  const CASES: [string, string[], Row[]][] = [
    ['all known', ['a', 'b'], ROWS],
    ['one unknown', ['a', 'gone', 'c'], ROWS],
    ['all unknown', ['x'], ROWS],
    ['empty order', [], ROWS],
    ['empty rows', ['a'], []],
    ['duplicates are preserved, as filter does', ['a', 'a'], ROWS],
    ['order is the ID list\'s, not the rows\'', ['c', 'a'], ROWS],
  ];

  it.each(CASES)('matches the old expression exactly: %s', (_label, ids, items) => {
    expect(retainKnownIds(ids, items)).toEqual(reference(ids, items));
  });
});
