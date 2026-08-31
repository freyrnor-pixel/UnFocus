/**
 * cardOrder.ts — the order a screen's cards are drawn in, as pure functions.
 *
 * ⚠️ **A FIFTH axis. Read the other four before adding a sixth** — the names are close enough
 * that the distinction has to be stated every time:
 *   · `lib/cardLayout.ts` — how much DETAIL a row shows (per surface, a user setting).
 *   · `lib/padState.ts` — HOW MANY rows are drawn (preview/open, the footer chevron).
 *   · `lib/collapsedCards.ts` — whether a card's BODY is drawn (the header chevron).
 *   · `lib/hiddenCards.ts` — whether the card is on the screen AT ALL.
 *   · **this** — what ORDER the ones that are there come in.
 *
 * **Why it exists (2026-09-01).** The maintainer's original ask was *"one button per screen for
 * reordering and/or hiding cards"*. 2026-08-30 built the button and the hiding; reorder was
 * deferred, because the data model was not the missing piece — `cardsForScreen()` had no consumer
 * at all and every screen's cards were hardcoded JSX. That deferral was reported back as *"not
 * how we agreed to do it"*, and this is the other half.
 *
 * **Presentation only, and enforced like the other four.** A card moved down the screen keeps its
 * reminders, its counts and its rows. Not in `aiSetupApply`'s `SETTINGS_WHITELIST` — an
 * AI-authored file must not be able to rearrange the app's surfaces, the same carve-out
 * `collapsed_cards`, `hidden_cards` and `design_lab` take — and not in `SyncTable`, because the
 * order YOU keep YOUR cards in is not household state.
 *
 * Dependency-free on purpose, like its four siblings: this is evaluated in the render path of
 * every screen, so it must not be able to reach a store, the DB, the notification layer or the
 * sync layer. `lib/__tests__/cardOrder.test.ts` source-scans it for exactly that.
 *
 * Connections:
 *   Imports → lib/cardRegistry (CardKey, CardScreen, cardsForScreen — the ids and the DEFAULT
 *             order this layers a user's choice over)
 *   Used by → lib/useCardOrder.ts, components/ManageCardsSheet.tsx,
 *             store/useSettingsStore.ts (sanitize on read)
 *   Data    → none directly; the shape stored in settings.cardOrder / the `card_order` column
 *
 * Edit notes:
 *   - **A stored order is a PREFERENCE LIST, not the truth.** `orderedCards` always returns every
 *     card the registry gives that screen: stored ids first in their stored order, then anything
 *     the list does not mention, in registry order. That is what makes a NEW card appear (at its
 *     registry position among the leftovers) instead of vanishing for everyone who has ever
 *     reordered, which is the failure mode a stored-order-is-truth model has.
 *   - **A partial list is normal, not damage.** Moving one card writes a complete list, but a
 *     list written before a card existed is short by exactly that card, and must keep working.
 *   - Unknown ids are dropped on read, and ids belonging to another screen with them — a stored
 *     order is per screen, so a `shopLists` in the `todo` list is either a bug or a restored
 *     backup from a build where that card lived elsewhere.
 */
import { CardKey, CardScreen, cardsForScreen } from '@/lib/cardRegistry';

/** Per screen, the user's preferred order. Absent or partial is normal — see the Edit notes. */
export type CardOrder = Partial<Record<CardScreen, CardKey[]>>;

/**
 * Validate a stored value. Anything that is not an object of screen → array-of-known-ids becomes
 * `{}` — the app as designed — rather than throwing or half-applying.
 *
 * Ids are checked against the SCREEN they are filed under, not just against the registry, so a
 * card that moved screens cannot leave a ghost in its old one's order.
 */
export function sanitizeCardOrder(raw: unknown): CardOrder {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CardOrder = {};
  for (const [screen, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const valid = cardsForScreen(screen as CardScreen);
    if (!valid.length) continue; // not a screen the registry knows
    const allowed = new Set<string>(valid);
    const seen = new Set<string>();
    const ids: CardKey[] = [];
    for (const id of value) {
      if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id as CardKey);
    }
    if (ids.length) out[screen as CardScreen] = ids;
  }
  return out;
}

/**
 * The cards to draw on `screen`, in order.
 *
 * Stored ids first, then every card the stored list does not mention, in registry order. Always
 * returns the complete set — hiding is `lib/hiddenCards.ts`'s job and is applied by `Card` itself,
 * not here, so that a hidden card keeps its POSITION and comes back where it was rather than at
 * the end.
 */
export function orderedCards(order: CardOrder, screen: CardScreen): CardKey[] {
  const all = cardsForScreen(screen);
  const stored = order[screen];
  if (!stored?.length) return all;
  const known = new Set(all);
  const first = stored.filter((id) => known.has(id));
  const placed = new Set(first);
  return [...first, ...all.filter((id) => !placed.has(id))];
}

/**
 * Move one card one step, and return the complete new order for that screen.
 *
 * Returns the SAME object reference when nothing moves — the card is already at that end, or the
 * id is not on that screen. That makes "the button did nothing" a testable assertion rather than
 * a silent no-op write, the same guard `lib/storeCrud.ts` exists for one rung down.
 */
export function withCardMoved(
  order: CardOrder,
  screen: CardScreen,
  id: CardKey,
  direction: -1 | 1
): CardOrder {
  const current = orderedCards(order, screen);
  const from = current.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= current.length) return order;
  const next = [...current];
  next[from] = next[to];
  next[to] = id;
  return { ...order, [screen]: next };
}

/**
 * Replace a screen's order outright — the drag's commit, which knows the whole new arrangement.
 *
 * Same no-op contract as `withCardMoved`: an order identical to the current one returns the same
 * object reference, so a drag that ends where it started writes nothing.
 */
export function withCardOrder(order: CardOrder, screen: CardScreen, ids: CardKey[]): CardOrder {
  const current = orderedCards(order, screen);
  if (ids.length === current.length && ids.every((id, i) => id === current[i])) return order;
  return { ...order, [screen]: ids };
}
