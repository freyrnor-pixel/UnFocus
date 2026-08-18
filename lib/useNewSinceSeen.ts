/**
 * useNewSinceSeen.ts — "what is this view showing me that the last one was hiding".
 *
 * Compares what is on screen now against lib/viewSnapshot.ts's record of the last saved
 * view, and reports the difference so the surface can glow it. Two kinds of difference:
 *
 *   - **Rows** the previous layout was not drawing. Switching from "Now and next" (two
 *     tasks) to the full timeline reveals the six it was collapsing; those six glow.
 *   - **Fields** the previous layout was not drawing. Switching from "Just the basics" to
 *     "Show everything" reveals quantities and prices on rows that were already on screen;
 *     those values glow, the rows around them do not.
 *
 * **This is about visibility, not novelty.** A glowing row is not new data — the user
 * recognises it and knows they've used it before. It glows because the view they just left
 * was hiding it. Nothing here looks at when a row was created.
 *
 * The diff is recomputed on arrival AND on every layout change, then frozen until the next
 * one. That cadence is the feature: switching layout is precisely when the user needs to be
 * told what just appeared. Between switches the set stays put, so the glow doesn't shift
 * while they read; and the snapshot is re-recorded immediately, so the *next* switch diffs
 * against what they can see now rather than against a view two changes ago.
 *
 * Connections:
 *   Imports → expo-router (useFocusEffect), lib/viewSnapshot
 *   Used by → app/(tabs)/shopping.tsx, app/plans.tsx, lib/__tests__/useNewSinceSeen.test.ts
 *   Data    → reads/writes only the `app_meta` snapshot row via lib/viewSnapshot.ts.
 *             Reads no entity table and writes none.
 *
 * Edit notes:
 *   - **This hook must never schedule, cancel, or re-sync a notification, and must never
 *     mutate an entity row.** A row being outside the visible layout is a display fact, not
 *     a behavioural one: it keeps every reminder it had. lib/__tests__/cardLayout.test.ts
 *     asserts this module's import graph stays free of lib/notifications and the stores.
 *   - **`ready` is load-bearing.** Recording a snapshot while the store is still empty would
 *     save "nothing was visible", and the next switch would then glow the entire list.
 *     Pass the store's own loaded flag; never pass a bare `true`.
 *   - **Pass the ids the layout actually DRAWS**, not every id the store holds. A row the
 *     current layout collapses must be absent from `visibleIds`, or it will be recorded as
 *     seen and never glow when a later layout reveals it — which is the whole feature.
 *   - The frozen diff intentionally does NOT update when `visibleIds` changes mid-visit. A
 *     row the user adds while looking at the surface is something they just did; it needs no
 *     glow, and the transient "just added" cue in store/useShoppingStore.ts already covers it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  FieldVisibility,
  NO_NEW_FIELDS,
  NewlyVisibleFields,
  getSnapshot,
  hasNoNewFields,
  newlyVisibleFields,
  newlyVisibleIds,
  setSnapshot,
} from '@/lib/viewSnapshot';

export type NewInView = {
  /**
   * Ids of rows the previous view was hiding. A stable Set, not a predicate, because
   * components/ShoppingRow.tsx is memoized on prop identity — a fresh closure each render
   * would defeat that, while this Set only changes identity when its contents do.
   */
  ids: ReadonlySet<string>;
  /** True when the previous view was hiding this row. */
  isNew: (id: string) => boolean;
  /** Fields the previous view wasn't drawing, for rows that were already on screen. */
  fields: NewlyVisibleFields;
  /** Clear one row's glow — call when the user interacts with it. */
  dismiss: (id: string) => void;
  /** Clear every glow on the surface. */
  markAllSeen: () => void;
  /** How many rows are currently flagged. */
  count: number;
};

const EMPTY: ReadonlySet<string> = new Set();

export function useNewSinceSeen(
  surface: string,
  /** Ids the CURRENT layout actually draws, in the order it draws them. */
  visibleIds: readonly string[],
  /** Which fields the current layout draws. */
  fields: FieldVisibility,
  /**
   * Identity of the current layout. Changing it is what re-runs the diff, so it must change
   * whenever what's drawn changes — pass the resolved layout id.
   */
  layoutKey: string,
  ready: boolean
): NewInView {
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(EMPTY);
  const [newFields, setNewFields] = useState<NewlyVisibleFields>(NO_NEW_FIELDS);

  // The layout this diff was last computed for. Recomputing is driven by this changing —
  // NOT by a plain once-per-visit latch — because switching layout while standing on the
  // surface is the primary way this feature is used ("go between the views and the newly
  // revealed things glow"). A visit-only latch would compute on arrival and then never
  // again, so every subsequent layout switch would reveal rows with no glow at all.
  // Reset to null on focus so returning to the surface re-diffs against the saved view.
  const lastKeyRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      lastKeyRef.current = null;
      return () => {
        lastKeyRef.current = null;
        setNewIds(EMPTY);
        setNewFields(NO_NEW_FIELDS);
      };
    }, [])
  );

  // Runs after commit, not during render: the reads and writes below are real side effects,
  // and doing them in the render phase would let React's StrictMode double-invoke record a
  // snapshot against a render it then throws away, losing the glow entirely.
  useEffect(() => {
    if (!ready) return;
    if (lastKeyRef.current === layoutKey) return;
    lastKeyRef.current = layoutKey;

    const previous = getSnapshot(surface);
    const revealedRows = newlyVisibleIds(visibleIds, previous);
    const revealedFields = newlyVisibleFields(fields, previous);

    setNewIds(revealedRows.length > 0 ? new Set(revealedRows) : EMPTY);
    setNewFields(hasNoNewFields(revealedFields) ? NO_NEW_FIELDS : revealedFields);

    // Re-record immediately, so the NEXT switch diffs against what the user can see now
    // rather than against a view two changes ago. Doing this before the user can act also
    // means a crash or a fast tab-away can't leave the surface re-announcing the same rows.
    setSnapshot(surface, { layout: layoutKey, ids: [...visibleIds], fields });
    // `visibleIds`/`fields` are deliberately NOT dependencies. They change on every list
    // mutation, and re-running then would both destroy the frozen diff and re-record the
    // snapshot mid-visit. The lastKeyRef guard above is what decides when this runs: once
    // per visit, and again on each layout change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, surface, layoutKey]);

  const dismiss = useCallback((id: string) => {
    setNewIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const markAllSeen = useCallback(() => {
    setNewIds((prev) => (prev.size === 0 ? prev : EMPTY));
    setNewFields((prev) => (hasNoNewFields(prev) ? prev : NO_NEW_FIELDS));
  }, []);

  const isNew = useCallback((id: string) => newIds.has(id), [newIds]);

  return useMemo(
    () => ({ ids: newIds, isNew, fields: newFields, dismiss, markAllSeen, count: newIds.size }),
    [newIds, isNew, newFields, dismiss, markAllSeen]
  );
}
