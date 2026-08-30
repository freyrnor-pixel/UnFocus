/**
 * hiddenCards.ts — which cards the user has put away, as pure functions.
 *
 * Maintainer, 2026-08-30, asked whether the affordance should be a per-card "⋮" (matching Home)
 * or one control per screen: *"One for each screen, not per card."* So a screen carries a single
 * "Manage cards" header icon opening `components/ManageCardsSheet.tsx`, which lists that screen's
 * cards with a switch each — and because that list shows hidden cards too, these screens need no
 * "Retired" shelf. Home is the one that does: its only hide affordance is per-card, so something
 * has to name what is gone.
 *
 * ⚠️ **This is a THIRD axis, and the names are close enough to be worth stating.**
 *   · `lib/cardLayout.ts` — how much DETAIL a row shows (per surface, a user setting).
 *   · `lib/padState.ts` — HOW MANY rows are drawn (preview/open, the footer chevron).
 *   · `lib/collapsedCards.ts` — whether a card's BODY is drawn (the header chevron).
 *   · **this** — whether the card is on the screen AT ALL.
 * A collapsed card is still there, still counted, still one tap from its rows. A hidden one is
 * not drawn, and the only way back is the sheet that hid it.
 *
 * **Presentation only, enforced the same way the other three are.** A hidden card's rows keep
 * their reminders and still count everywhere else in the app; nothing is unloaded, disabled or
 * deferred. Not in `aiSetupApply`'s `SETTINGS_WHITELIST` — an AI-authored file must not be able
 * to hide the app's surfaces, the same carve-out `collapsed_cards` and `design_lab` take — and
 * not in `SyncTable`, because which cards YOU keep on YOUR screen is not household state.
 *
 * Dependency-free on purpose, like lib/collapsedCards.ts, lib/cardLayout.ts and lib/growth.ts:
 * this is evaluated in the render path of every card, so it must not be able to reach a store,
 * the DB, the notification layer or the sync layer. `lib/__tests__/hiddenCards.test.ts`
 * source-scans it for exactly that. The hook that DOES touch the store is lib/useHiddenCard.ts.
 *
 * Connections:
 *   Imports → lib/cardRegistry (CardKey + CARD_KEYS — the id set this validates against)
 *   Used by → lib/useHiddenCard.ts, components/ManageCardsSheet.tsx,
 *             store/useSettingsStore.ts (sanitize on read)
 *   Data    → none directly; the shape stored in settings.hiddenCards / the `hidden_cards` column
 *
 * Edit notes:
 *   - **An ARRAY, not a bag of booleans**, which is where this deliberately differs from
 *     `collapsedCards`. That one stores only what the user moved OFF a card's resting state, so
 *     `{}` keeps meaning "the app as designed" and a card whose default later moves follows it.
 *     Hiding has no per-card default to diverge from — every card starts visible — so the honest
 *     shape is "the ones you put away", and an empty array says exactly that.
 *   - **Unknown ids are dropped on read.** A card removed from the registry (or a restored backup
 *     from an older build) must not keep a screen's sheet showing a row for something that no
 *     longer exists. Same reasoning as `sanitizeCollapsedCards`.
 *   - There is deliberately **no floor of one visible card.** A screen CAN be emptied. That is
 *     safe here and was not on Home's old "Edit cards" mode: the entry point is permanent header
 *     chrome, so an empty screen is always one tap from having its cards back.
 */
import { CARD_KEYS, CardKey } from '@/lib/cardRegistry';

/** The cards the user has put away, in no meaningful order. */
export type HiddenCards = CardKey[];

function isCardKey(value: unknown): value is CardKey {
  return typeof value === 'string' && (CARD_KEYS as readonly string[]).includes(value);
}

/**
 * Validate a stored value. Anything that is not an array of known card ids becomes `[]` — the
 * app as designed — rather than throwing or half-applying.
 */
export function sanitizeHiddenCards(raw: unknown): HiddenCards {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<CardKey>();
  for (const entry of raw) if (isCardKey(entry)) seen.add(entry);
  return [...seen];
}

export function isHidden(hidden: HiddenCards, id: CardKey): boolean {
  return hidden.includes(id);
}

/** Add or remove one id, leaving every other card alone. */
export function withHidden(hidden: HiddenCards, id: CardKey, next: boolean): HiddenCards {
  const without = hidden.filter((k) => k !== id);
  return next ? [...without, id] : without;
}
