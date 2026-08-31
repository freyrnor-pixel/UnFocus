/**
 * prefill.ts — "arrive on a screen with this text already typed in".
 *
 * The receiving half of a note's ⋯ → Send it to… (components/SendToSheet.tsx, 2026-07-30).
 * Sending a note to another surface navigates there with the note's text on the route, and
 * that surface's add field opens seeded and focused, so the user lands mid-edit rather than
 * on a screen where they have to find the add row and retype what they just wrote.
 *
 * Deliberately a route param, not a store field or a new column: it is a one-shot handoff
 * between two screens, worth nothing a second later, and it must not survive a reload. A
 * "pending prefill" row in SQLite would be a piece of UI state that outlives the intent.
 *
 * Connections:
 *   Imports → expo-router (useLocalSearchParams, useRouter)
 *   Used by → components/SendToSheet.tsx's callers (the sending side builds the route),
 *             app/(tabs)/{plans,shopping,habits}.tsx (the receiving side). Habits receives
 *             TWO of them — its own habit quick-add and, in the `goals` slot, the Goals
 *             drawer's add row (2026-08-12, when app/goals.tsx was retired)
 *   Data    → none — reads and clears a route param
 *
 * Edit notes:
 *   - `usePrefill` CONSUMES the param: it hands the text back once and immediately clears it
 *     off the route, so navigating away and back doesn't re-seed a field the user already
 *     dealt with, and a back-navigation doesn't resurrect text they deleted.
 *   - The consumer decides what "seeded and focused" means for its own surface (a screen-level
 *     draft, a specific list's add row). This module only carries the string.
 *   - **A SLOT is what lets one screen host two destinations (2026-08-12).** Goals used to have
 *     a screen of its own (app/goals.tsx, a near-copy of components/GoalsEditor.tsx) and could
 *     therefore be addressed by route alone. It is now a drawer on the Habits tab — which
 *     already consumes a prefill for its habit quick-add — so a note sent to Goals and a note
 *     sent to Habits arrive at the SAME route, and the plain-route version of this module
 *     would have let the habit composer swallow the goal and silently create a habit named
 *     after the note. `usePrefill(slot)` hands the text over only when the route's own slot
 *     matches; every other consumer on that screen returns '' and, crucially, does NOT clear
 *     the param out from under the one that wants it.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Route param name. Keep in sync with every `router.push` that sends a prefill. */
export const PREFILL_PARAM = 'prefill';
/** Which field on the destination screen the text is for. Absent = that screen's own default. */
export const PREFILL_SLOT_PARAM = 'prefillSlot';

/** A named field on a screen that hosts more than one prefill destination. */
export type PrefillSlot = 'goals';

/** The route to send `text` to for each SendToSheet target. */
export function prefillRoute(target: 'todo' | 'shopping' | 'habits' | 'goals', text: string) {
  // ⚠️ **'goals' routes to the POP-UP as of 2026-09-01, not to the Habits tab.** It used to land
  // on `/(tabs)/habits`, whose card held a folded `GoalsEditor` consuming the `goals` slot. That
  // section is deleted — goal editing is reached from the goal picker's own "Edit goals" row now
  // — so the old route would have dropped the note's text on the floor while still ticking the
  // note off, which is precisely the failure components/SendToSheet.tsx hides the Goals target
  // for when the feature is switched off.
  const pathname =
    target === 'todo'
      ? '/(tabs)/plans'
      : target === 'shopping'
        ? '/(tabs)/shopping'
        : target === 'goals'
          ? '/goals-editor'
          : '/(tabs)/habits';
  // The slot survives the move. It is no longer needed to tell Goals apart from the Habits tab's
  // own composer (nothing else lives on that route), but `usePrefill(slot)` is what makes a
  // prefill addressed rather than ambient, and a route with one consumer today can gain a second.
  const params =
    target === 'goals'
      ? { [PREFILL_PARAM]: text, [PREFILL_SLOT_PARAM]: 'goals' }
      : { [PREFILL_PARAM]: text };
  return { pathname, params } as const;
}

/**
 * Whether a prefill carrying `routeSlot` is addressed to the consumer asking for `slot`.
 *
 * Its own function because it is the whole safety property — a wrong answer here doesn't throw
 * or render oddly, it files the user's note as the wrong KIND of thing — and because a hook
 * can't be exercised in this repo's test env (no renderer). See lib/__tests__/prefill.test.ts.
 */
export function prefillIsFor(routeSlot: string | undefined, slot?: PrefillSlot): boolean {
  return (routeSlot ?? '') === (slot ?? '');
}

/**
 * The prefill text this screen was opened with, delivered exactly once.
 *
 * Returns '' on every render except the one right after arriving with a matching param. Seed
 * your add field from it in an effect and focus that field.
 *
 * `slot` names which field on this screen is asking. Omit it for the screen's own primary
 * composer; pass one for a secondary destination that happens to live on the same route.
 */
export function usePrefill(slot?: PrefillSlot): string {
  const params = useLocalSearchParams<{ prefill?: string; prefillSlot?: string }>();
  const router = useRouter();
  const rawText = typeof params.prefill === 'string' ? params.prefill : '';
  const rawSlot = typeof params.prefillSlot === 'string' ? params.prefillSlot : '';
  // Only the addressed consumer takes it. Anything else on this screen stays out of the way
  // entirely — including the clear below, which would otherwise destroy the handoff.
  const mine = prefillIsFor(rawSlot, slot);
  const [text, setText] = useState('');
  const consumed = useRef('');

  useEffect(() => {
    if (!rawText || !mine || consumed.current === rawText) return;
    consumed.current = rawText;
    setText(rawText);
    // Clear it off the route so coming back to this screen doesn't re-seed the field.
    router.setParams({ [PREFILL_PARAM]: undefined, [PREFILL_SLOT_PARAM]: undefined } as never);
  }, [rawText, mine, router]);

  return text;
}
