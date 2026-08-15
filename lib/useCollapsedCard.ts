/**
 * useCollapsedCard.ts — one card's collapsed state plus its setter, as a hook.
 *
 * Sibling of lib/useCardState.ts, and in its own file for the same reason: lib/collapsedCards.ts
 * stays pure, so whether a card is folded away can never reach a store, the DB or the
 * notification layer from a render path.
 *
 * Connections:
 *   Imports → lib/collapsedCards (CardId, isCollapsed, withCollapsed), store/useSettingsStore
 *   Used by → the tab screens that draw a collapsible content card — app/(tabs)/index.tsx,
 *             plans.tsx, habits.tsx, health.tsx, shopping.tsx — usually alongside
 *             components/CardCollapseToggle.tsx
 *   Data    → reads + writes settings.collapsedCards (the only writer)
 *
 * Edit notes:
 *   - Selects `collapsedCards` as a single field rather than the whole store, so a card only
 *     re-renders when that column changes — the field-level-selector convention
 *     app/(tabs)/index.tsx already follows.
 *   - `toggle` merges through `withCollapsed`, so one card's chevron never clears another's.
 *   - Returns `[collapsed, toggle]` rather than a setter: every call site is a chevron, and a
 *     `setCollapsed(true)` from somewhere that isn't the user's own tap would be a surface
 *     disappearing on its own. If a screen ever genuinely needs to force one, add a second
 *     return value rather than widening this one.
 */
import { useCallback } from 'react';
import { CardId, isCollapsed, withCollapsed } from '@/lib/collapsedCards';
import { useSettingsStore } from '@/store/useSettingsStore';

export function useCollapsedCard(id: CardId): [boolean, () => void] {
  const collapsedCards = useSettingsStore((s) => s.collapsedCards);
  const update = useSettingsStore((s) => s.update);
  const collapsed = isCollapsed(collapsedCards, id);

  const toggle = useCallback(
    () => update({ collapsedCards: withCollapsed(collapsedCards, id, !collapsed) }),
    [collapsedCards, collapsed, id, update],
  );

  return [collapsed, toggle];
}
