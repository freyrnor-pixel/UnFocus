/**
 * useHiddenCard.ts — whether one card is put away, plus its setter, as a hook.
 *
 * Sibling of lib/useCollapsedCard.ts, and in its own file for the same reason: lib/hiddenCards.ts
 * stays pure, so "is this card on the screen" can never reach a store, the DB or the notification
 * layer from a render path.
 *
 * Connections:
 *   Imports → lib/cardRegistry (CardKey, type only), lib/hiddenCards (isHidden, withHidden),
 *             store/useSettingsStore
 *   Used by → components/Card.tsx (which returns null for a hidden card, so this works for every
 *             card in the app without a caller doing anything), components/ManageCardsSheet.tsx
 *   Data    → reads + writes settings.hiddenCards (the sheet is the only writer)
 *
 * Edit notes:
 *   - Selects `hiddenCards` as a single field rather than the whole store, so a card only
 *     re-renders when that column changes — the field-level-selector convention the rest of the
 *     card system follows.
 *   - `setHidden` takes the value rather than toggling, unlike `useCollapsedCard`. Its call site
 *     is a Switch, which knows what it is being set to; a toggle would make the sheet's row and
 *     the stored value able to disagree after a fast double tap.
 *   - `useIsCardHidden` is the read-only half, for `Card` — it must not pull the setter into the
 *     render path of every card in the app.
 */
import { useCallback } from 'react';
import type { CardKey } from '@/lib/cardRegistry';
import { isHidden, withHidden } from '@/lib/hiddenCards';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Read-only: is this card put away? Used by every Card, so it stays as small as possible. */
export function useIsCardHidden(id: CardKey): boolean {
  return useSettingsStore((s) => isHidden(s.hiddenCards, id));
}

/** Read + write, for the Manage cards sheet. */
export function useHiddenCard(id: CardKey): [boolean, (next: boolean) => void] {
  const hiddenCards = useSettingsStore((s) => s.hiddenCards);
  const update = useSettingsStore((s) => s.update);
  const hidden = isHidden(hiddenCards, id);

  const setHidden = useCallback(
    (next: boolean) => update({ hiddenCards: withHidden(hiddenCards, id, next) }),
    [hiddenCards, id, update],
  );

  return [hidden, setHidden];
}
