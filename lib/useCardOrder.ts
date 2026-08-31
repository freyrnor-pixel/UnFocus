/**
 * useCardOrder.ts — a screen's card order, plus its two setters, as a hook.
 *
 * Sibling of lib/useHiddenCard.ts and lib/useCollapsedCard.ts, and in its own file for the same
 * reason: lib/cardOrder.ts stays pure, so "what order do these cards come in" can never reach a
 * store, the DB or the notification layer from a render path.
 *
 * Connections:
 *   Imports → lib/cardRegistry (CardKey/CardScreen, types only), lib/cardOrder (orderedCards,
 *             withCardMoved, withCardOrder), store/useSettingsStore
 *   Used by → components/TodoSurface.tsx, components/HabitsSurface.tsx,
 *             components/HealthSurface.tsx, app/(tabs)/shopping.tsx, app/(tabs)/index.tsx
 *             (all read `useOrderedCards`), components/ManageCardsSheet.tsx (the writer)
 *   Data    → reads + writes settings.cardOrder (the sheet is the only writer)
 *
 * Edit notes:
 *   - `useOrderedCards` is the read-only half, for the five screens. It must not pull a setter
 *     into a render path, and it selects `cardOrder` alone rather than the whole store.
 *   - It memoises on `(cardOrder, screen)`, because it returns a fresh ARRAY each call and its
 *     result is what a screen `.map()`s over — an unmemoised identity would re-render every card
 *     on the screen on any unrelated settings write.
 *   - Both setters go through lib/cardOrder.ts's same-reference no-op contract, so a move at
 *     either end, or a drag that ends where it started, writes nothing at all.
 */
import { useCallback, useMemo } from 'react';
import type { CardKey, CardScreen } from '@/lib/cardRegistry';
import { orderedCards, withCardMoved, withCardOrder } from '@/lib/cardOrder';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Read-only: the cards to draw on `screen`, in the user's order. Complete, always. */
export function useOrderedCards(screen: CardScreen): CardKey[] {
  const cardOrder = useSettingsStore((s) => s.cardOrder);
  return useMemo(() => orderedCards(cardOrder, screen), [cardOrder, screen]);
}

/** Read + write, for the Manage cards sheet. */
export function useCardOrder(screen: CardScreen): {
  ids: CardKey[];
  move: (id: CardKey, direction: -1 | 1) => void;
  setOrder: (ids: CardKey[]) => void;
} {
  const cardOrder = useSettingsStore((s) => s.cardOrder);
  const update = useSettingsStore((s) => s.update);
  const ids = useMemo(() => orderedCards(cardOrder, screen), [cardOrder, screen]);

  const move = useCallback(
    (id: CardKey, direction: -1 | 1) => {
      const next = withCardMoved(cardOrder, screen, id, direction);
      if (next !== cardOrder) update({ cardOrder: next });
    },
    [cardOrder, screen, update],
  );

  const setOrder = useCallback(
    (next: CardKey[]) => {
      const bag = withCardOrder(cardOrder, screen, next);
      if (bag !== cardOrder) update({ cardOrder: bag });
    },
    [cardOrder, screen, update],
  );

  return { ids, move, setOrder };
}
