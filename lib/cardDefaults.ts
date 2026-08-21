/**
 * cardDefaults.ts — which cards are drawn OPEN when the user has chosen nothing, in one place.
 *
 * Maintainer, 2026-08-21: *"All card start in closed state, except 'Today' 'Notes' and
 * 'Shopping' in middle screen."* Inverting that default is not one setting to flip, which is
 * why this module exists. `CONSISTENCY_AUDIT.md` §3 measured **five independent collapse
 * mechanisms with three different defaults** — and the three cards named as exceptions are
 * drawn by two different ones, with "Today" reachable through either depending on the active
 * layout. So the exceptions are stated ONCE here, as card ids, and each mechanism reads its own
 * slice. Neither mechanism carries a default of its own any more.
 *
 * | The card | Drawn by | Id here |
 * |---|---|---|
 * | To-do's Today, default (timeline) layout | `lib/padState.ts` | `'plans'` |
 * | To-do's Today, the other layouts | `lib/collapsedCards.ts` | `'plansToday'` |
 * | Me's Notes | `lib/padState.ts` | `'notes'` |
 * | Shop's Shopping lists | `lib/collapsedCards.ts` | `'shopLists'` |
 *
 * Dependency-free, like the two modules that read it: this is evaluated in the render path of
 * every tab, so it must not be able to reach a store, the DB or the notification layer.
 *
 * Connections:
 *   Imports → nothing (deliberately — see above)
 *   Used by → lib/collapsedCards.ts, lib/padState.ts
 *   Data    → none; it decides what an ABSENT entry in settings.collapsedCards /
 *             settings.cardStates means
 *
 * Edit notes:
 *   - **Adding a card here is a maintainer decision, not a tidy-up.** The list is short on
 *     purpose: it is the set of cards whose content is the reason to open the app at all. A
 *     fourth entry makes "everything starts closed" stop being true as a sentence.
 *   - **The two lists are typed as plain strings, and that is deliberate.** Typing them as
 *     `CardId`/`PadSurface` would make this module import both unions, and both of those
 *     modules import this one — a cycle. The unions still do the validating at the point that
 *     matters: `lib/__tests__/collapsedCards.test.ts` asserts every id here is a real id of the
 *     mechanism that reads it, so a typo is still caught, just by a test rather than by tsc.
 *   - This decides only the RESTING state. Once a user folds or unfolds a card, their choice is
 *     stored and this stops applying to it — see `withCollapsed`/`withCardState`, which delete
 *     the key again when the chosen state happens to equal the default.
 */

/**
 * Cards that `lib/collapsedCards.ts` draws open when the user has not chosen. Every other
 * `CardId` starts folded.
 */
export const CARDS_OPEN_AT_REST: readonly string[] = ['plansToday'] as const;

/**
 * Pad surfaces that `lib/padState.ts` draws at 'preview' when the user has not chosen. Every
 * other surface starts 'closed'.
 *
 * 'preview' rather than 'open' is the same call the pad cards have always made: the point of a
 * three-state card is that its resting size is a glance, not the whole list.
 */
export const PAD_SURFACES_OPEN_AT_REST: readonly string[] = ['plans', 'notes'] as const;
