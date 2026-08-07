/**
 * designLabPlace.ts — where a part sits in a card's own space, as arithmetic.
 *
 * The design lab's playground lets a part be dropped anywhere in the card body rather than
 * flowing one-per-line. This module is the half of that which can be reasoned about without a
 * finger: given a card body's measured box and its rows' measured bands, which grid cell is
 * the finger over; and given a part list, what does the body actually lay out as.
 *
 * **It is split out for the reason `slotAtPoint` was, and it is not optional.** Playwright
 * cannot activate `react-native-gesture-handler`'s `activateAfterLongPress` in the web build
 * at all — confirmed against the app's own shipped drag — so a drag is unreachable by every
 * automated check this repo has. Splitting the arithmetic out is what makes any of it
 * verifiable; the gesture itself needs a device, and every capability here also has a
 * tap-only route in the UI so that route can be driven headlessly.
 *
 * **The grid is four columns and `col` is an ORDER, not a coordinate.** A row renders as a
 * flex row whose children carry `flex: span`, so two cells summing to less than four leave a
 * spacer and cells never overlap — which is why nothing here does collision detection.
 * `normalizePlacements` is what keeps `col` agreeing with `span` after any change.
 *
 * Connections:
 *   Imports → lib/designLab (the part model, BODY_COLS, clampPlace, isPlaceableSlot, SlotBox)
 *   Used by → components/DesignLabCard.tsx (laying the body out, and the drop hit-test),
 *             app/design-lab/index.tsx (committing a drop), lib/__tests__/designLabPlace.test.ts
 *   Data    → none. Pure functions over values the caller already has.
 *
 * Edit notes:
 *   - **Dependency-free, like lib/designLab.ts and lib/cardLayout.ts.** It is called from a
 *     render path; `lib/__tests__/designLab.test.ts`'s import-graph scan covers this file too.
 *   - **Rows are measured at drag START, never at layout.** The card scrolls inside a
 *     scrolling screen and a scroll fires no `onLayout`, so mount-time boxes describe where
 *     the card used to be. Same rule `lib/useDragReorder.ts` and `PartHandle` already follow.
 *   - A part with no `place` is not an error — it is the state every part is in until it is
 *     moved, and every pre-v3 part is in forever. `layoutBodyParts` gives it its own
 *     full-width row rather than inventing a position for it.
 */
import {
  BODY_COLS,
  clampPlace,
  type CardPart,
  type PartPlace,
  type SlotBox,
} from '@/lib/designLab';

/** One laid-out row of the card body: its parts, in the order they are drawn across it. */
export type BodyRow = {
  /** The part's own `place.row` value, so a measured band and a laid-out row agree. */
  row: number;
  cells: { part: CardPart; col: number; span: number }[];
};

/** Where a drop landed. `insert` means "between rows" — a new row, not an existing one. */
export type BodyCell = { row: number; col: number; insert: boolean };

/**
 * The body's parts, grouped into rows and ordered across each one.
 *
 * Placed parts occupy their own rows, ascending. Parts with no `place` are appended AFTER
 * them as their own full-width rows, in list order — which is what makes a v2 card and a
 * freshly-dropped part both render sanely without either of them needing a position invented
 * for it. The caller passes ONE band's parts (body or footer); this does not filter, because
 * the two bands are drawn in different places and must not share a grid.
 */
export function layoutBodyParts(parts: CardPart[]): BodyRow[] {
  const byRow = new Map<number, BodyRow['cells']>();
  const flowing: CardPart[] = [];

  for (const part of parts) {
    if (!part.place) {
      flowing.push(part);
      continue;
    }
    const { row, col, span } = clampPlace(part.place);
    const cells = byRow.get(row) ?? [];
    cells.push({ part, col, span });
    byRow.set(row, cells);
  }

  const rows: BodyRow[] = [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, cells]) => ({ row, cells: cells.slice().sort((a, b) => a.col - b.col) }));

  let next = rows.length ? rows[rows.length - 1].row + 1 : 0;
  for (const part of flowing) {
    rows.push({ row: next, cells: [{ part, col: 0, span: BODY_COLS }] });
    next += 1;
  }

  return rows;
}

/**
 * Which grid cell a finger at (x, y) is over — or `null` when it is outside the body.
 *
 * The direct sibling of `lib/designLab.ts`'s `slotAtPoint`, and it follows the same three
 * rules that one does, for the same reasons:
 *
 *   - A point inside an existing row's band answers that row, with the column taken from how
 *     far across the body the finger is.
 *   - A point in the GAP between two rows, or past the last one, answers `insert: true`. That
 *     is how a vertical stack gets built at all: dropping *between* things makes a new row,
 *     so no separate "add a row" control has to exist.
 *   - **Edges count as inside**, so a drop on a boundary lands somewhere rather than vanishing.
 *
 * `rows` are measured bands in the same coordinate space as `body` — window space in practice.
 */
export function bodyCellAtPoint(
  body: SlotBox,
  rows: { row: number; y: number; height: number }[],
  x: number,
  y: number,
): BodyCell | null {
  if (!body || body.width <= 0 || body.height <= 0) return null;
  if (x < body.x || x > body.x + body.width) return null;
  if (y < body.y || y > body.y + body.height) return null;

  const colWidth = body.width / BODY_COLS;
  const col = Math.min(BODY_COLS - 1, Math.max(0, Math.floor((x - body.x) / colWidth)));

  const measured = rows
    .filter((r) => r.height > 0)
    .slice()
    .sort((a, b) => a.y - b.y);

  for (const band of measured) {
    if (y >= band.y && y <= band.y + band.height) return { row: band.row, col, insert: false };
  }

  // Between two bands, or past the last one: count how many rows the finger is already below.
  let index = 0;
  for (const band of measured) {
    if (y > band.y + band.height) index += 1;
  }
  const rowAt = index < measured.length ? measured[index].row : (measured.length ? measured[measured.length - 1].row + 1 : 0);
  return { row: rowAt, col, insert: true };
}

/**
 * Rows renumbered 0…n-1 with gaps closed, and each row's columns made to agree with its spans.
 *
 * Two jobs in one pass, because they are the same pass: a removed row must not leave a hole,
 * and `col` is an order rather than a coordinate, so after any change it is re-derived as the
 * running total of the spans before it. A cell that would start past the last column is
 * clamped to the last one at width 1 rather than being pushed onto a row of its own — moving
 * a part to a row the maintainer did not choose is a worse answer than making it narrow.
 *
 * Idempotent: running it on its own output changes nothing.
 */
export function normalizePlacements(parts: CardPart[]): CardPart[] {
  const placed = parts.filter((p) => p.place);
  if (placed.length === 0) return parts;

  // Read the stored numbers WITHOUT `clampPlace` here. That helper clamps `span` against the
  // column it was stored at, and this pass is about to give the cell a different column — so
  // clamping first would shrink a span for a collision that is about to stop existing. The
  // clamp happens once, below, against the column the cell actually ends up in.
  const read = (place: PartPlace) => ({
    row: Number.isFinite(place.row) ? Math.max(0, Math.floor(place.row)) : 0,
    col: Number.isFinite(place.col) ? Math.max(0, Math.floor(place.col)) : 0,
    span: Number.isFinite(place.span) ? Math.max(1, Math.floor(place.span)) : BODY_COLS,
  });

  const rowValues = [...new Set(placed.map((p) => read(p.place as PartPlace).row))].sort((a, b) => a - b);
  const rowIndex = new Map(rowValues.map((value, index) => [value, index]));
  const cursor = new Map<number, number>();

  // Walk in laid-out order so "the running total of the spans before it" means the same thing
  // here as it does on screen.
  const order = new Map<string, PartPlace>();
  for (const row of rowValues) {
    const cells = placed
      .map((p) => ({ part: p, place: read(p.place as PartPlace) }))
      .filter((c) => c.place.row === row)
      .sort((a, b) => a.place.col - b.place.col);

    for (const cell of cells) {
      const used = cursor.get(row) ?? 0;
      const col = Math.min(BODY_COLS - 1, used);
      const span = Math.min(BODY_COLS - col, cell.place.span);
      cursor.set(row, col + span);
      order.set(cell.part.id, { row: rowIndex.get(row) as number, col, span });
    }
  }

  return parts.map((part) => {
    const place = order.get(part.id);
    return place ? { ...part, place } : part;
  });
}

/**
 * The part list with `id` moved to `cell`.
 *
 * On an `insert` every placed part at or below that row shifts down one, so the new row opens
 * where the finger let go rather than displacing whatever was there. The moved part's width is
 * whatever is still free on its destination row — dropping onto an empty row gives you the
 * full width, dropping beside a half gives you the other half — which is the behaviour that
 * makes "put these two side by side" work without a width control being touched first.
 *
 * Unknown id, or a part that is not in the card's own space, returns the SAME array reference:
 * a no-op has to be observable as one rather than as a silent re-render.
 */
export function placePart(parts: CardPart[], id: string, cell: BodyCell): CardPart[] {
  const target = parts.find((p) => p.id === id);
  if (!target) return parts;

  const shifted = cell.insert
    ? parts.map((p) => {
      if (p.id === id || !p.place) return p;
      const place = clampPlace(p.place);
      return place.row >= cell.row ? { ...p, place: { ...place, row: place.row + 1 } } : p;
    })
    : parts;

  const used = shifted
    .filter((p) => p.id !== id && p.place && clampPlace(p.place).row === cell.row)
    .reduce((sum, p) => sum + clampPlace(p.place as PartPlace).span, 0);
  const span = Math.max(1, BODY_COLS - used);

  const moved = shifted.map((p) =>
    p.id === id ? { ...p, place: clampPlace({ row: cell.row, col: cell.col, span }) } : p,
  );

  return normalizePlacements(moved);
}
