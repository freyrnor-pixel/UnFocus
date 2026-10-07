/**
 * CardAddButton.tsx — a header "+" that opens a card's own composer (2026-10-07).
 *
 * Maintainer, on Home's Notes and Shopping cards: *"legg til et lite pluss-ikon (+) til høyre i
 * kortet slik at brukeren kan opprette nye oppføringer direkte uten å måtte bytte fane."* Both
 * cards already HAVE a composer — it is just inside the fold, so on a closed card adding a line
 * cost a fold tap and a field tap. The "+" is those two taps as one: unfold if folded, then pull
 * the keyboard into the composer. It is not a second way to add; it is a shortcut to the one way.
 *
 * Passed through `Card`'s `controls` slot — the one caller-specific control a header may carry
 * (`lib/__tests__/cardAnatomy.test.ts`). Sized like the ⤢ beside it (`IconSize.compact`, tap
 * target still floored at 48 by `IconButton`).
 *
 * Connections:
 *   Imports → components/IconButton, constants/theme (IconSize), lib/i18n,
 *             lib/useCollapsedCard, lib/collapsedCards (CardId type)
 *   Used by → components/HomeNotesCard.tsx, components/HomeShoppingCard.tsx
 *   Data    → settings.collapsedCards (via useCollapsedCard — unfolds the card)
 */
import React, { useCallback, useState } from 'react';
import IconButton from '@/components/IconButton';
import { IconSize } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import type { CardId } from '@/lib/collapsedCards';
import { useCollapsedCard } from '@/lib/useCollapsedCard';

/**
 * The "+" and the focus counter it drives. Hand `focusRequest` to the card's `DraftComposer`
 * and `button` to the card's `controls`.
 */
export function useCardAddButton(id: CardId): { button: React.ReactNode; focusRequest: number } {
  const t = useT();
  const [collapsed, toggleCollapsed] = useCollapsedCard(id);
  const [focusRequest, setFocusRequest] = useState(0);
  const onPress = useCallback(() => {
    if (collapsed) toggleCollapsed();
    setFocusRequest((n) => n + 1);
  }, [collapsed, toggleCollapsed]);
  const button = <IconButton icon="add" label={t.a11yAdd} onPress={onPress} size={IconSize.compact} />;
  return { button, focusRequest };
}
