/**
 * cardPane.ts — which card, if any, is currently being drawn AS the full-screen pane's body.
 *
 * **The defect this exists to close (2026-08-28, measured):** an expanded pane drew the card's
 * title TWICE. `components/CardExpandHost.tsx` paints its own title bar and close control, and
 * then mounts a surface (`<TodoSurface section="today"/>`, `<HabitsSurface/>`, …) whose whole
 * job is to render `<Card id="todoToday">` — a second `Surface`, a second header with the badge,
 * the count, the fold chevron and its own ⤢, and a second set of paddings inside the pane's.
 * Measured on Home's Today card at 430×932: **65px of pane header, then a 52px card header
 * saying the same word**, plus 24px of the card's own vertical padding and 16px of horizontal
 * padding stacked inside the pane's own 16px. It also drew two controls that cannot mean
 * anything there — a fold chevron on a full-screen pane, and an ⤢ on an already-expanded card.
 *
 * That is the card-in-a-card the 2026-08-18 blueprint pass banned, in the one place nothing was
 * looking: `components/Card.tsx`'s `embedded` prop drops the Surface and the horizontal padding
 * but deliberately KEEPS the header, because its callers (a section inside a card) still need
 * one. A pane needs the opposite — the body without the header — and there was no way to say so.
 *
 * **The mechanism is a context rather than a prop, because the caller cannot pass one.** Nothing
 * in `CardExpandHost` renders a `Card` directly; it mounts a whole surface component, which
 * decides several cards down which one to draw. A prop would have to be threaded through every
 * surface's own props (`section`, `embedded`, …) and every one of them would have to remember to
 * forward it. The context is read by `Card` itself, so a card cannot forget.
 *
 * **It matches by id, and the id is named by the pane entry, not inferred.** `homeToday`'s body
 * is `<TodoSurface section="today"/>`, which draws `todoToday` — deliberately, since Home's card
 * is a PREVIEW of that card and its full-screen version must be the same surface rather than a
 * second rendering. So the pane entry says which card it is showing (`card`), defaulting to the
 * pane's own id, and `lib/__tests__/expandableCards.test.ts` pins the one entry where they
 * differ. Matching "the first Card rendered inside a pane" instead was rejected: React gives no
 * ordering hook that survives a re-render, so "first" would be whichever child happened to
 * commit first, which is exactly the kind of thing that is right in the preview and wrong on a
 * device.
 *
 * Connections:
 *   Imports → lib/cardRegistry (CardKey)
 *   Used by → components/Card.tsx (reads it), components/CardExpandHost.tsx (provides it)
 *   Data    → none
 *
 * Edit notes:
 *   - **A card that claims the pane re-provides `null` to its own subtree**, so a nested card
 *     with the same id (there is none today, and there should not be) cannot claim it a second
 *     time and strip its own header. Cheap, and it makes the claim single by construction.
 *   - Default `null` means "not in a pane", which is every ordinary screen. A card outside a
 *     pane never pays for this beyond one context read.
 */
import React from 'react';
import type { CardKey } from '@/lib/cardRegistry';

/**
 * The card id the open pane is showing, or `null` when nothing is expanded / this subtree is
 * not the pane's body. Read by `components/Card.tsx`; provided by `components/CardExpandHost.tsx`.
 */
export const PaneCardContext = React.createContext<CardKey | null>(null);

/** True when THIS card is the one the open pane is drawing, and so must not draw a card at all. */
export function useIsPaneBody(id: CardKey): boolean {
  return React.useContext(PaneCardContext) === id;
}
