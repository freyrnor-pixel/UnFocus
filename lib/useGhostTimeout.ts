/**
 * useGhostTimeout.ts — the shared timing behind an inline "ghost row" undo affordance.
 *
 * A just-deleted row (Habits, Notes) stays offered as a restorable "ghost" for a few
 * seconds, or until the screen loses focus (swiping to another tab, navigating away),
 * whichever comes first — then `onExpire` finalizes it. The underlying delete already
 * happened at delete time either way (see store/useHabitStore.ts's and
 * store/useNotesStore.ts's `remove()` — a soft-delete/tombstone, mirroring the
 * existing tasks/shopping pattern); this hook only decides how long the row keeps
 * showing an undo option, not whether the data can still be recovered.
 *
 * Connections:
 *   Imports → expo-router (useFocusEffect)
 *   Used by → app/habits.tsx (useHabitStore.lastDeleted), app/notes.tsx
 *             (useNotesStore.lastDeleted)
 *   Data    → none — the caller's store holds the actual pending-ghost value; this hook
 *             only times how long it stays offered
 *
 * Edit notes:
 *   - `active` is whatever the caller's "a ghost is currently shown" flag is (their store's
 *     `lastDeleted !== null`). The timer (re)starts whenever it flips from falsy to truthy;
 *     restoring is the caller's own action and already clears the store field, so there is
 *     nothing extra to cancel on that path.
 *   - Losing focus calls `onExpire` immediately — same "leaving discards transient UI state"
 *     precedent as lib/useFirstVisitHint.ts's blur-collapse.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

export function useGhostTimeout(active: boolean, onExpire: () => void, durationMs = 5000): void {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => onExpireRef.current(), durationMs);
    return () => clearTimeout(id);
  }, [active, durationMs]);

  useFocusEffect(
    useCallback(() => {
      return () => onExpireRef.current();
    }, [])
  );
}
