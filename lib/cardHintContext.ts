/**
 * cardHintContext.ts — "is the card around me already showing its 💡 hint?"
 *
 * **One empty card, one line of explanation (2026-10-11, V2 card rule).** An empty card drew its
 * hint (components/CardHintLine.tsx) AND a narrator quote (components/NarratorQuote.tsx) one
 * above the other — reported twice by the maintainer as *"the tips and instructions are still
 * doubled"*. Removing the identical lines (lib/narratorQuotes.ts, 2026-10-07) fixed the literal
 * duplicate but not the stacking: two different italic sentences on one empty card still read
 * as doubled.
 *
 * The rule is now structural: `components/Card.tsx` provides `true` here while it draws a hint,
 * and NarratorQuote renders nothing inside such a card. A hint is only passed while the card is
 * EMPTY, so the narrator's voice still appears where the hint does not — a card whose list was
 * cleared by FINISHING it (rows exist, so no hint), and every surface without a hint at all.
 *
 * Connections:
 *   Imports → react
 *   Used by → components/Card.tsx (provider), components/NarratorQuote.tsx (reader)
 *   Data    → none
 */
import { createContext, useContext } from 'react';

export const CardHintContext = createContext(false);

/** True inside a card that is currently drawing its hint line. */
export function useCardShowsHint(): boolean {
  return useContext(CardHintContext);
}
