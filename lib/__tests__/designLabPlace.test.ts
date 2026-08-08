/**
 * designLabPlace.test.ts — the arithmetic under the design lab's free placement.
 *
 * This file is not ordinary unit testing either: the gesture these functions serve **cannot be
 * driven by any automated check this repo has**. Playwright does not activate
 * react-native-gesture-handler's `activateAfterLongPress` in the web build — confirmed against
 * the app's own shipped drag — so `npm run preview` can prove nothing about a drop. Splitting
 * the maths out and pinning it here is the entire coverage of that half of the feature, which
 * is why the suites below mirror `slotAtPoint`'s in lib/__tests__/designLab.test.ts: the same
 * three questions (inside, outside, overlapping) asked of the body grid instead of the row.
 */
import { BODY_COLS, type CardPart } from '@/lib/designLab';
import {
  bodyCellAtPoint,
  layoutBodyParts,
  normalizePlacements,
  placePart,
} from '@/lib/designLabPlace';

function part(id: string, place?: { row: number; col: number; span: number }): CardPart {
  return { id, kind: 'text', slot: 'body', label: '', color: '', size: 'sm', weight: 'regular', ...(place ? { place } : {}) };
}

describe('layoutBodyParts', () => {
  it('gives a part with no place its own full-width row', () => {
    const rows = layoutBodyParts([part('a'), part('b')]);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toHaveLength(1);
    expect(rows[0].cells[0].span).toBe(BODY_COLS);
    expect(rows.map((r) => r.cells[0].part.id)).toEqual(['a', 'b']);
  });

  it('puts two placed parts on one row, in column order', () => {
    const rows = layoutBodyParts([
      part('right', { row: 0, col: 2, span: 2 }),
      part('left', { row: 0, col: 0, span: 2 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells.map((c) => c.part.id)).toEqual(['left', 'right']);
  });

  it('orders rows by their row index, not by list order', () => {
    const rows = layoutBodyParts([part('second', { row: 3, col: 0, span: 4 }), part('first', { row: 1, col: 0, span: 4 })]);
    expect(rows.map((r) => r.cells[0].part.id)).toEqual(['first', 'second']);
  });

  // A v2 card has no `place` on anything, and a freshly added part has none either. Both have
  // to render sanely beside parts that do, without a position being invented for them.
  it('appends flowing parts after the placed ones', () => {
    const rows = layoutBodyParts([part('flowing'), part('placed', { row: 0, col: 0, span: 2 })]);
    expect(rows.map((r) => r.cells[0].part.id)).toEqual(['placed', 'flowing']);
    expect(rows[1].row).toBeGreaterThan(rows[0].row);
  });

  it('is empty for an empty card', () => {
    expect(layoutBodyParts([])).toEqual([]);
  });
});

describe('bodyCellAtPoint', () => {
  const body = { x: 0, y: 100, width: 400, height: 200 };
  const rows = [
    { row: 0, y: 100, height: 40 },
    { row: 1, y: 160, height: 40 },
  ];

  it('finds the row the finger is inside', () => {
    expect(bodyCellAtPoint(body, rows, 10, 120)).toEqual({ row: 0, col: 0, insert: false });
    expect(bodyCellAtPoint(body, rows, 10, 180)).toEqual({ row: 1, col: 0, insert: false });
  });

  it('reads the column off how far across the body the finger is', () => {
    expect(bodyCellAtPoint(body, rows, 10, 120)!.col).toBe(0);
    expect(bodyCellAtPoint(body, rows, 150, 120)!.col).toBe(1);
    expect(bodyCellAtPoint(body, rows, 250, 120)!.col).toBe(2);
    expect(bodyCellAtPoint(body, rows, 390, 120)!.col).toBe(3);
  });

  // Dropping BETWEEN things is how a vertical stack gets built at all — without it there would
  // have to be a separate "add a row" control, which is a thing to learn rather than a thing
  // to do.
  it('answers insert in the gap between two rows', () => {
    const cell = bodyCellAtPoint(body, rows, 10, 150);
    expect(cell).toEqual({ row: 1, col: 0, insert: true });
  });

  it('answers insert past the last row, so a drop at the bottom appends', () => {
    const cell = bodyCellAtPoint(body, rows, 10, 280);
    expect(cell).toEqual({ row: 2, col: 0, insert: true });
  });

  it('answers the first row when the body has none yet', () => {
    expect(bodyCellAtPoint(body, [], 10, 150)).toEqual({ row: 0, col: 0, insert: true });
  });

  it('answers nothing when the point is off the body', () => {
    expect(bodyCellAtPoint(body, rows, 10, 50)).toBeNull();
    expect(bodyCellAtPoint(body, rows, 10, 400)).toBeNull();
    expect(bodyCellAtPoint(body, rows, -5, 120)).toBeNull();
    expect(bodyCellAtPoint(body, rows, 500, 120)).toBeNull();
  });

  it('answers nothing for a body that has not been measured', () => {
    expect(bodyCellAtPoint({ x: 0, y: 0, width: 0, height: 0 }, rows, 0, 0)).toBeNull();
  });

  // Same rule slotAtPoint follows: a drop on a boundary has to land somewhere rather than
  // vanishing under the finger.
  it('counts the edges as inside', () => {
    expect(bodyCellAtPoint(body, rows, 0, 100)).toEqual({ row: 0, col: 0, insert: false });
    expect(bodyCellAtPoint(body, rows, 400, 140)).toEqual({ row: 0, col: 3, insert: false });
  });

  it('ignores a row measured as nothing', () => {
    const cell = bodyCellAtPoint(body, [{ row: 0, y: 100, height: 0 }], 10, 120);
    expect(cell!.insert).toBe(true);
  });
});

describe('normalizePlacements', () => {
  it('leaves a card with nothing placed alone, by reference', () => {
    const parts = [part('a'), part('b')];
    expect(normalizePlacements(parts)).toBe(parts);
  });

  it('closes a gap left by a removed row', () => {
    const out = normalizePlacements([part('a', { row: 0, col: 0, span: 4 }), part('b', { row: 5, col: 0, span: 4 })]);
    expect(out.map((p) => p.place!.row)).toEqual([0, 1]);
  });

  // `col` is an order, not a coordinate — after any change it is re-derived as the running
  // total of the spans before it, so the row and the export line agree.
  it('re-derives columns from the spans before them', () => {
    const out = normalizePlacements([
      part('a', { row: 0, col: 0, span: 2 }),
      part('b', { row: 0, col: 3, span: 2 }),
    ]);
    expect(out.map((p) => p.place)).toEqual([
      { row: 0, col: 0, span: 2 },
      { row: 0, col: 2, span: 2 },
    ]);
  });

  // Moving a part to a row the maintainer did not choose is a worse answer than making it
  // narrow, so a cell that would start past the last column is clamped rather than pushed off.
  it('clamps a cell that would run past the last column instead of moving its row', () => {
    const out = normalizePlacements([
      part('a', { row: 0, col: 0, span: 4 }),
      part('b', { row: 0, col: 1, span: 2 }),
    ]);
    expect(out[1].place).toEqual({ row: 0, col: BODY_COLS - 1, span: 1 });
  });

  it('is idempotent', () => {
    const once = normalizePlacements([part('a', { row: 2, col: 3, span: 3 }), part('b', { row: 9, col: 0, span: 1 })]);
    expect(normalizePlacements(once)).toEqual(once);
  });

  it('leaves flowing parts flowing', () => {
    const out = normalizePlacements([part('placed', { row: 4, col: 0, span: 4 }), part('flowing')]);
    expect(out[0].place).toEqual({ row: 0, col: 0, span: 4 });
    expect(out[1].place).toBeUndefined();
  });
});

describe('placePart', () => {
  it('gives a part dropped on an empty row the full width', () => {
    const out = placePart([part('a')], 'a', { row: 0, col: 0, insert: true });
    expect(out[0].place).toEqual({ row: 0, col: 0, span: BODY_COLS });
  });

  // This is what makes "put these two side by side" work without a width control being
  // touched first: the second part takes whatever the first left.
  it('gives a part dropped beside another whatever width is left', () => {
    const parts = [part('a', { row: 0, col: 0, span: 2 }), part('b')];
    const out = placePart(parts, 'b', { row: 0, col: 2, insert: false });
    expect(out.find((p) => p.id === 'b')!.place).toEqual({ row: 0, col: 2, span: 2 });
  });

  it('opens a new row on an insert, pushing what was there down', () => {
    const parts = [part('a', { row: 0, col: 0, span: 4 }), part('b')];
    const out = placePart(parts, 'b', { row: 0, col: 0, insert: true });
    expect(out.find((p) => p.id === 'b')!.place!.row).toBe(0);
    expect(out.find((p) => p.id === 'a')!.place!.row).toBe(1);
  });

  it('moves a part between existing rows', () => {
    const parts = [part('a', { row: 0, col: 0, span: 4 }), part('b', { row: 1, col: 0, span: 4 })];
    const out = placePart(parts, 'b', { row: 0, col: 0, insert: false });
    expect(out.find((p) => p.id === 'b')!.place!.row).toBe(0);
  });

  it('hands back the same array for an id that is not there', () => {
    const parts = [part('a')];
    expect(placePart(parts, 'nope', { row: 0, col: 0, insert: true })).toBe(parts);
  });
});
