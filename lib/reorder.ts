/**
 * reorder.ts — pure drag-to-reorder math (insertion index from finger position).
 *
 * The one non-trivial calculation behind the drag reorder used by both the shopping list and
 * Home's hold-to-manage cards: given the dragged row's live window-space centerY and a
 * start-of-drag snapshot of every row's position, where does the dragged row belong in the order?
 * Extracted so it's unit-testable without mounting a screen (which pulls native modules).
 *
 * Connections:
 *   Imports → —
 *   Used by → app/(tabs)/shopping.tsx (handleDragMove reorder preview),
 *             components/HomeCardManager.tsx (Home preview-card reorder)
 *   Data    → none — pure
 *
 * Edit notes:
 *   - The dragged row is EXCLUDED from the count. Counting how many OTHER rows the finger center
 *     has passed makes the result a stable step function of finger position — it never reads the
 *     live order, so a completed swap can't shift a boundary back under the finger and cause the
 *     row to oscillate (the pre-2026-07-20 version iterated the live order against static
 *     positions and flickered hard at every swap boundary).
 *   - `snapshot` positions are window-space and captured once at drag-start; the non-dragged rows
 *     keep their relative order throughout a drag (only the dragged row moves), so a plain count is
 *     correct regardless of iteration order.
 */

/** Start-of-drag position of a row in window space. */
export type RowSnapshot = { y: number; height: number };

/**
 * Insertion index for the dragged row among the others, from the finger's window-space centerY.
 * Excludes `draggedId`; returns 0…(others.length). Rows missing from `snapshot` are ignored.
 */
export function computeReorderInsertIndex(
  centerY: number,
  order: string[],
  draggedId: string,
  snapshot: Record<string, RowSnapshot>,
): number {
  let insertion = 0;
  for (const id of order) {
    if (id === draggedId) continue;
    const layout = snapshot[id];
    if (!layout) continue;
    if (centerY > layout.y + layout.height / 2) insertion++;
  }
  return insertion;
}

/**
 * The full reordered array with `draggedId` re-inserted at its finger-driven slot. Callers compare
 * the result against the previous order to decide whether anything changed (and whether to animate).
 */
export function reorderByDrag(
  centerY: number,
  order: string[],
  draggedId: string,
  snapshot: Record<string, RowSnapshot>,
): string[] {
  const targetIndex = computeReorderInsertIndex(centerY, order, draggedId, snapshot);
  const next = order.filter((id) => id !== draggedId);
  next.splice(targetIndex, 0, draggedId);
  return next;
}
