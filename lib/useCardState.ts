/**
 * useCardState.ts — one surface's pad size (closed/preview/open) plus its setter, as a hook.
 *
 * Sibling of lib/useSurfaceLayout.ts, and in its own file for the same reason: lib/padState.ts
 * stays pure so a card's SIZE can never reach a store or the notification layer. The two hooks
 * cover the two independent axes — `useSurfaceLayout` is how much detail a row shows,
 * `useCardState` is how many rows are drawn at all.
 *
 * Connections:
 *   Imports → lib/padState (PadState, resolveCardState, withCardState), lib/cardLayout
 *             (LayoutSurface type), store/useSettingsStore
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/plans.tsx
 *   Data    → reads + writes settings.cardStates (the only writer; the footer chevron drives it)
 *
 * Edit notes:
 *   - Selects `cardStates` as a single field (not the whole store) so a card only re-renders
 *     when that column changes — the field-level-selector convention app/(tabs)/index.tsx
 *     already follows.
 *   - `setState` merges through `withCardState`, so one card's chevron never clears another
 *     card's saved size.
 */
import { useCallback } from 'react';
import type { LayoutSurface } from '@/lib/cardLayout';
import { PadState, resolveCardState, withCardState } from '@/lib/padState';
import { useSettingsStore } from '@/store/useSettingsStore';

export function useCardState(surface: LayoutSurface): [PadState, (next: PadState) => void] {
  const cardStates = useSettingsStore((s) => s.cardStates);
  const update = useSettingsStore((s) => s.update);
  const state = resolveCardState(cardStates, surface);

  const setState = useCallback(
    (next: PadState) => update({ cardStates: withCardState(cardStates, surface, next) }),
    [cardStates, surface, update]
  );

  return [state, setState];
}
