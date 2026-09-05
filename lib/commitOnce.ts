/**
 * commitOnce.ts — single-flight for "create the entity, then leave for its editor".
 *
 * Connections:
 *   Imports → react (useCallback, useRef)
 *   Used by → components/TodoSurface.tsx (`useCommitAndEdit`, itself used by the Whenever
 *             composer, the shared Today/Calendar/Recurring composer, and the timeline's
 *             add-and-edit), components/MedicineSurface.tsx (`commitAdd`'s More hand-off)
 *   Data     → none directly; it only sequences the caller's own create + hand-off
 *
 * ## Why this exists
 *
 * Tier-3 "More" (`components/AddRow.tsx`'s `onMore`) is a commit-then-hand-off: the surface
 * writes the row, then navigates to the full editor carrying the new id. That pairing has a
 * duplicate-entity failure mode that is invisible until a user finds two identical tasks in
 * their list.
 *
 * The mechanism: `onMore` calls `setExpanded(false)`, which blurs the `TextInput`. On a blur or
 * keyboard-dismiss path that also fires `onSubmitEditing`, the composer's *commit* runs a second
 * time in the same press. It cannot defend itself by reading its own cleared draft — the
 * `setValue('')` that every commit ends with has not flushed yet within that frame, so the
 * second call still sees the typed title and writes a second row.
 *
 * So the guard has to be a ref, not derived state.
 *
 * ## The release
 *
 * The flag is released on a `setTimeout(…, 0)` rather than synchronously in a `finally`. A
 * synchronous release would only stop true re-entrancy — a handler firing *during* `create()` —
 * and the blur-driven double is dispatched just after it, in the same event-loop turn. Releasing
 * on the next turn covers that and still opens well before any second human press.
 */

import { useRef } from 'react';

/** What `useCommitOnce` hands back — see `createCommitOnce`. */
export type CommitOnce = <T>(create: () => T | null | undefined, handOff: (created: T) => void) => void;

/**
 * The guard itself, as a plain factory so it can be tested without rendering anything (this repo
 * has no hook-rendering library — see `lib/__tests__/commitOnce.test.ts`).
 *
 * Returns a `run(create, handOff)` that invokes `create` **at most once per event-loop turn** and
 * hands its result to `handOff` only if something was actually created.
 *
 * A falsy return from `create` means "nothing was made" — the empty-line case, where More is
 * deliberately inert: no entity, no navigation, no error. `handOff` is not called. Note this
 * still spends the turn's single-flight window: a create that declined to write is the same
 * press as one that did.
 */
export function createCommitOnce(): CommitOnce {
  let inFlight = false;

  return (create, handOff) => {
    if (inFlight) return;
    inFlight = true;
    setTimeout(() => {
      inFlight = false;
    }, 0);

    const created = create();
    if (created) handOff(created);
  };
}

/**
 * One guard per mounted composer, stable for the life of the mount — the flag has to survive
 * re-renders, which is the whole point, and a fresh closure per render would not.
 */
export function useCommitOnce(): CommitOnce {
  const run = useRef<CommitOnce | null>(null);
  if (!run.current) run.current = createCommitOnce();
  return run.current;
}
