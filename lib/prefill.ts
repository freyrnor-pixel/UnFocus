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
 *             app/(tabs)/{plans,shopping,habits}.tsx + app/goals.tsx (the receiving side)
 *   Data    → none — reads and clears a route param
 *
 * Edit notes:
 *   - `usePrefill` CONSUMES the param: it hands the text back once and immediately clears it
 *     off the route, so navigating away and back doesn't re-seed a field the user already
 *     dealt with, and a back-navigation doesn't resurrect text they deleted.
 *   - The consumer decides what "seeded and focused" means for its own surface (a screen-level
 *     draft, a specific list's add row). This module only carries the string.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Route param name. Keep in sync with every `router.push` that sends a prefill. */
export const PREFILL_PARAM = 'prefill';

/** The route to send `text` to for each SendToSheet target. */
export function prefillRoute(target: 'todo' | 'shopping' | 'habits' | 'goals', text: string) {
  const pathname =
    target === 'todo'
      ? '/(tabs)/plans'
      : target === 'shopping'
        ? '/(tabs)/shopping'
        : target === 'habits'
          ? '/(tabs)/habits'
          : '/goals';
  return { pathname, params: { [PREFILL_PARAM]: text } } as const;
}

/**
 * The prefill text this screen was opened with, delivered exactly once.
 *
 * Returns '' on every render except the one right after arriving with a param. Seed your add
 * field from it in an effect and focus that field.
 */
export function usePrefill(): string {
  const params = useLocalSearchParams<{ prefill?: string }>();
  const router = useRouter();
  const raw = typeof params.prefill === 'string' ? params.prefill : '';
  const [text, setText] = useState('');
  const consumed = useRef('');

  useEffect(() => {
    if (!raw || consumed.current === raw) return;
    consumed.current = raw;
    setText(raw);
    // Clear it off the route so coming back to this screen doesn't re-seed the field.
    router.setParams({ [PREFILL_PARAM]: undefined } as never);
  }, [raw, router]);

  return text;
}
