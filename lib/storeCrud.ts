/**
 * storeCrud.ts — the by-id row triple every store's `add`/`update`/`remove` performs.
 *
 * One rung above lib/dataAccess.ts. That module knows about SQL — tables, columns and
 * `FieldMap`s; this one knows about the shape a Zustand store keeps in memory: an array of
 * rows with a string `id`, mirrored into SQLite. Ten stores wrote the same eight lines for
 * `update(id, patch)` and six wrote the same four for `remove(id)`.
 *
 * **The reason to share them is the guard, not the lines.** The canonical shape opens by
 * looking the id up in memory and returning if it isn't there:
 *
 *     const note = get().notes.find((n) => n.id === id);
 *     if (!note) return;
 *
 * Eight of the ten `update`s did that; `useHealthStore` and `useMedicineStore` did not, and
 * had not since they were written. An unguarded update for an id the store doesn't hold
 * still runs an UPDATE against SQLite, still hands `set()` a freshly-mapped array (so every
 * subscriber re-renders for a change that did not happen), and still fires whatever the
 * action's tail does — for medicines that is `syncTrayReminders()`, a full cancel-and-
 * rearm of four tray notifications through the path lib/medicineNotifications.ts's header
 * warns can un-schedule what it just armed. Nothing about the call site said which of the
 * two shapes a store had; the guard was a habit, and two stores were written without it.
 * Inside `updateById`/`deleteById` it is no longer possible to leave out.
 *
 * Connections:
 *   Imports → lib/db (the DELETE), lib/dataAccess (updateRow, rowValues, FieldMap)
 *   Used by → store/useHabitStore.ts, store/useHealthStore.ts, store/useMealStore.ts,
 *             store/useMedicineStore.ts, store/useMomentsStore.ts,
 *             store/useMonthlyListStore.ts, store/useNotesStore.ts, store/usePeopleStore.ts,
 *             store/useSharedStore.ts, store/useShoppingListStore.ts,
 *             store/useShoppingStore.ts, store/useTaskStore.ts,
 *             store/useAutomationStore.ts
 *   Data    → runs UPDATE/DELETE against the named table on the shared `unfocus.db` handle
 *
 * Edit notes:
 *   - **The guard makes "not loaded" and "not present" the same answer.** A store whose
 *     `load()` hasn't run holds `[]`, so every update is a no-op instead of a blind write.
 *     That is the trade the eight guarded stores already made and it is the right one here
 *     — every caller of these actions is a screen, and screens mount after
 *     app/_layout.tsx's boot load. Don't add a "write anyway if empty" escape hatch; a
 *     store that genuinely needs to write a row it hasn't loaded wants `updateRow` directly.
 *   - **`deleteById` is for HARD deletes only.** The tombstone stores (notes, habits, tags,
 *     people, shopping items) write `deleted_at`/`deleted` so a peer or an undo can still
 *     see the row, and three of them do it inside a `tx()` alongside cascade SQL. Those
 *     stay explicit — same call as lib/syncRow.ts's edit note: don't force a
 *     non-uniform transaction into a helper without reading it first.
 *   - **Cascades stay at the call site.** `deleteById` deletes one row from one table.
 *     `useMedicineStore.remove` and `useGoalStore.remove` fan out to other tables in a
 *     transaction and are deliberately not routed through here.
 *   - `updateById` writes ONLY the columns the patch names (that is `updateRow`'s
 *     contract), and merges by spread — so a patch carrying an explicit `undefined` clears
 *     that field in memory and binds it as a parameter, exactly as the hand-rolled versions
 *     did. `useShoppingStore.unmarkPurchased` relies on this.
 *   - The function form of `patch` exists for a caller that has to READ the row to decide
 *     what to write — `useTaskStore.update` re-derives `durationMinutes` from the merged
 *     start/finish pair. Without it that store would have to find the row itself and would
 *     be back outside the guard, which is the whole point of the module.
 *   - It imports `@/lib/db` directly rather than growing a `deleteRow` in dataAccess: that
 *     would be a fifth builder used at one site here and ~15 hand-rolled DELETEs elsewhere
 *     that this pass is not converting, i.e. a half-swept API. Store tests mock `@/lib/db`,
 *     so the DELETE stays observable either way.
 */
import db from '@/lib/db';
import { FieldMap, rowValues, updateRow } from '@/lib/dataAccess';

/** Anything this module can address: a row the store keeps in an array under a string id. */
type Identified = { id: string };

/**
 * **`rows` is the ONLY argument `T` may be inferred from, and the `NoInfer`s are what make
 * that true.** `FieldMap<T>` and `Partial<T>` are both homomorphic over `T`, so TypeScript
 * infers `T` backwards out of them too — and a store passes `Partial<Omit<Row, 'id'>>` as
 * its patch, which has no `id` and so fails the `Identified` constraint. That losing
 * candidate doesn't lose quietly: inference falls back to the constraint, every call
 * silently resolves to bare `{ id: string }`, and the store gets `Identified[]` back where
 * its own row type belongs. Removing either `NoInfer` reproduces it across every caller at
 * once. (Measured against TS 6.0; `lib/__tests__/storeCrud.test.ts` pins the call shape.)
 */
type RowMap<T> = FieldMap<NoInfer<T>>;
type RowPatch<T> = NoInfer<Partial<T> | ((row: T) => Partial<T>)>;

/**
 * Replace the row carrying `next.id`, leaving order and every other row untouched.
 *
 * Always returns a new array, like the `.map()` it replaces — call it inside `set((s) => …)`
 * over `s.rows`, never over an array captured before the write, or a concurrent update in
 * the same tick is dropped.
 */
export function replaceById<T extends Identified>(rows: readonly T[], next: T): T[] {
  return rows.map((r) => (r.id === next.id ? next : r));
}

/**
 * The guarded partial UPDATE behind every store's `update(id, patch)`.
 *
 * Returns the merged row to hand to `replaceById`, or **null when `id` isn't in `rows`** —
 * in which case nothing was written and the caller must return without touching state or
 * firing its side effects.
 *
 * `patch` may be a function of the found row for a caller that has to read it to decide
 * what to write; whatever it returns is both written and merged, so the row in memory and
 * the row in SQLite can't disagree.
 */
export function updateById<T extends Identified>(
  table: string,
  map: RowMap<T>,
  rows: readonly T[],
  id: string,
  patch: RowPatch<T>
): T | null {
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  const effective = typeof patch === 'function' ? patch(row) : patch;
  updateRow(table, rowValues(effective, map), 'id = ?', [id]);
  return { ...row, ...effective };
}

/**
 * The guarded hard DELETE behind a store's `remove(id)`.
 *
 * Returns the removed row (some callers stage it, or clean up rows pointing at it), or
 * **null when `id` isn't in `rows`** — nothing was deleted and the caller must return.
 * Soft-deleting stores and cascading deletes do NOT come through here; see the header.
 */
export function deleteById<T extends Identified>(table: string, rows: readonly T[], id: string): T | null {
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  db.runSync(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return row;
}

/** Drop the row `id` names from a collection. Pairs with `deleteById` inside `set()`. */
export function withoutId<T extends Identified>(rows: readonly T[], id: string): T[] {
  return rows.filter((r) => r.id !== id);
}
