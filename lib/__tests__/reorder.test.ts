/**
 * reorder.test.ts — drag-reorder insertion math, incl. the anti-flicker regression guard.
 */
import { computeReorderInsertIndex, reorderByDrag, RowSnapshot } from '@/lib/reorder';

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
