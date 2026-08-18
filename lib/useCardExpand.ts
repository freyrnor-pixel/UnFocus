/**
 * useCardExpand.ts — the hook a card uses to grow itself to fill the screen.
 *
 * Hands back a `ref` for the card's outermost View (attach it there, nowhere deeper — a rect
 * measured off an inner wrapper animates from the wrong box) and an `onExpand` that measures
 * that view in WINDOW coordinates and hands the rect to components/CardExpandHost.tsx's
 * imperative `expandCard()`. `expanded` is true while THIS card's id is the one showing, for a
 * caller that wants to dim/skip its own heavy content underneath the (opaque) overlay — most
 * callers can ignore it and just pass it straight to components/CardExpandButton.tsx.
 *
 * Connections:
 *   Imports → components/CardExpandHost (expandCard, collapseCard, useExpandedCardId),
 *             lib/expandableCards (ExpandableCardId), react-native (View)
 *   Used by → every card that mounts a components/CardExpandButton.tsx in its header
 *   Data    → none
 */
import { useRef } from 'react';
import type { View } from 'react-native';
import { collapseCard, expandCard, useExpandedCardId } from '@/components/CardExpandHost';
import type { ExpandableCardId } from '@/lib/expandableCards';

export function useCardExpand(id: ExpandableCardId) {
  const ref = useRef<View>(null);
  const expandedId = useExpandedCardId();
  const expanded = expandedId === id;

  function onExpand() {
    ref.current?.measureInWindow((x, y, width, height) => {
      expandCard(id, { x, y, width, height });
    });
  }

  return { ref, expanded, onExpand, onCollapse: collapseCard };
}
