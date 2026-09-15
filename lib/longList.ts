/**
 * longList.ts — the ceiling on a list the user has already opened, and the maths for it.
 *
 * **Not the same question as `lib/padState.ts`.** That one owns how many rows a card draws at
 * rest — a PREVIEW, three rows, persisted per surface, chosen by the user as a size. This owns
 * what happens at the other end: a list the user has deliberately unfolded, which has no upper
 * bound because the data behind it has none.
 *
 * The case that forced it: `lib/db.ts`'s `RETENTION_DAYS` is 365, and `pruneOldData()` only
 * deletes tasks that are completed AND dated AND non-recurring. An open task, a recurring one,
 * or anything undated is kept indefinitely by design. So To-do's "Ferdig" zone grows for as long
 * as the install lives, every row mounts a `TaskCard` (~2000 lines), and nothing capped it.
 * No harness in this repo could ever have reported that: the cost scales with a data set no
 * harness has, so `npm run visual` is unchanged at any list length.
 *
 * Connections:
 *   Imports → constants/theme (LONG_LIST_CAP)
 *   Used by → components/TodoSurface.tsx (the "Mer" and "Ferdig" sections)
 *   Data    → none — pure functions over values the caller already has
 *
 * Edit notes:
 *   - **Keep this side-effect free**, for the reason `padState.ts` states for itself: a row the
 *     cap is holding back is still a live row. It keeps its reminders, still counts in every
 *     total, and is still in the store. This module decides what is DRAWN and nothing else.
 *   - The cap is per-section local state, deliberately NOT persisted. `settings.cardStates` is
 *     for sizes the user chose; this is a performance floor they did not ask for, and having it
 *     reset when the section is folded away again is the behaviour that cannot surprise anyone.
 *   - ⚠️ **Do not reach for this on a DRAG list.** To-do's "Når som helst" is reorderable, and a
 *     drag order naming a row the cap has not rendered is a reorder that cannot complete. It is
 *     left uncapped on purpose; see TodoSurface's note at that call site.
 */
import { LONG_LIST_CAP } from '@/constants/theme';

/**
 * The rows to draw: everything when the user has asked for everything, otherwise the first
 * `LONG_LIST_CAP`.
 *
 * Returns the input array itself when nothing is held back, so an uncapped list costs no copy
 * and keeps its identity for any memo downstream.
 */
export function longListVisible<T>(rows: readonly T[], showAll: boolean): readonly T[] {
  if (showAll || rows.length <= LONG_LIST_CAP) return rows;
  return rows.slice(0, LONG_LIST_CAP);
}

/** How many rows the cap is holding back — the count on the "N more" control. 0 when none. */
export function longListHidden(total: number, showAll: boolean): number {
  if (showAll) return 0;
  return Math.max(0, total - LONG_LIST_CAP);
}
