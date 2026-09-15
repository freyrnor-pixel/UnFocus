/**
 * reorder.ts — pure drag-to-reorder math: the insertion index from a finger position, and the
 * projection of a drag order back onto rows.
 *
 * The one non-trivial calculation behind the drag reorder used by both the shopping list and
 * Home's hold-to-manage cards: given the dragged row's live window-space centerY and a
 * start-of-drag snapshot of every row's position, where does the dragged row belong in the order?
 * Extracted so it's unit-testable without mounting a screen (which pulls native modules).
 *
 * Connections:
 *   Imports → —
 *   Used by → reorderByDrag: app/(tabs)/shopping.tsx (handleDragMove reorder preview),
 *             components/ManageCardsSheet.tsx (card reorder, on every screen),
 *             components/MonthlyResetReviewSheet.tsx
 *             projectOrder (2026-09-15): components/TodoSurface.tsx, components/HabitsSurface.tsx,
 *             components/NotesSurface.tsx, components/MonthlyResetReviewSheet.tsx,
 *             app/(tabs)/shopping.tsx
 *             retainKnownIds (2026-09-15): store/useHabitStore.ts, store/useTaskStore.ts
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


/**
 * Projects a drag order back onto the rows it names: `orderedIds` → the matching items, in that
 * order, with ids that no longer exist dropped.
 *
 * **Why this exists, rather than the one-liner it replaces.** Seven call sites had independently
 * written `orderedIds.map((id) => items.find((x) => x.id === id)).filter(Boolean)`. That is a
 * linear scan per id, so it costs O(n²) in the number of rows — invisible with the handful of
 * items a test or a fresh install has, and quietly quadratic for a user with a year of data. Two
 * of those sites run inside a drag, which re-renders per frame.
 *   This builds one Map and does n lookups. Same output, same order, same dropped-id behaviour.
 *
 * Deliberately NOT generic over the key name: every rows-with-ids type in this app uses `id`, and
 * a `keyOf` parameter would be a configuration point with exactly one value.
 *
 * `undefined` entries are dropped rather than preserved as holes, which is what all seven call
 * sites already did with their `.filter(Boolean)` — an id can outlive its row (a delete arriving
 * mid-drag, a live-sync tombstone), and a hole would crash the row renderer.
 */
export function projectOrder<T extends { id: string }>(orderedIds: readonly string[], items: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) byId.set(item.id, item);
  const out: T[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) out.push(item);
  }
  return out;
}

/**
 * The same projection where the caller wants the IDS back, not the rows: keeps only ids that still
 * name a live row, in the given order.
 *
 * Separate from `projectOrder` rather than folded into it because the two store-layer call sites
 * (`store/useHabitStore.ts`, `store/useTaskStore.ts`) were written as `orderedIds.filter((id) =>
 * rows.some((r) => r.id === id))` — also O(n²), but they want the id list, and routing them
 * through `projectOrder(...).map((r) => r.id)` would allocate a row array to throw it away.
 */
export function retainKnownIds(orderedIds: readonly string[], items: readonly { id: string }[]): string[] {
  const known = new Set<string>();
  for (const item of items) known.add(item.id);
  return orderedIds.filter((id) => known.has(id));
}
