/**
 * collapsedCards.ts — which content cards the user has folded away, as pure functions.
 *
 * Maintainer, 2026-08-14: *"Every card should be collapsable"*, and remembered across launches.
 * A collapsed card keeps its header and its chevron and draws nothing else; nothing about it is
 * unloaded, disabled or deferred — same presentation-only contract lib/cardLayout.ts has.
 *
 * **A card starts CLOSED as of 2026-08-21** (maintainer: *"All card start in closed state,
 * except 'Today' 'Notes' and 'Shopping' in middle screen"*). The exceptions are named in
 * lib/cardRegistry.ts as `openAtRest`, alongside everything else that is true of a card.
 * lib/cardDefaults.ts, which used to hold them, is deleted — the registry replaces it.
 *
 * Dependency-free on purpose, like lib/cardLayout.ts, lib/padState.ts and lib/growth.ts: this is
 * evaluated in the render path of every tab, so it must not be able to reach a store, the DB, the
 * notification layer or the sync layer. `lib/__tests__/collapsedCards.test.ts` source-scans it for
 * exactly that. The hook that DOES touch the store is lib/useCollapsedCard.ts, and the shared
 * chevron is components/CardCollapseToggle.tsx.
 *
 * Connections:
 *   Imports → lib/cardRegistry (CARDS — types + the fold/openAtRest declarations)
 *   Used by → lib/useCollapsedCard.ts, store/useSettingsStore.ts (sanitize on read)
 *   Data    → none directly; the shape stored in settings.collapsedCards / the
 *             `collapsed_cards` column
 *
 * Edit notes:
 *   - **This is NOT lib/padState.ts, and the two do not overlap.** `padState` is a THREE-state
 *     size (closed / preview / open) keyed by `LayoutSurface`, persisted in `card_states`, and
 *     driven by the footer chevron `components/PadFooterToggle.tsx` draws. It belongs to the four
 *     Home pad cards plus the To-do timeline, which are the cards built to show a partial list.
 *     This module is a plain boolean for every OTHER content card — the ones with a hand-rolled
 *     header and an all-or-nothing body. **The rule, so a later session doesn't "finish the
 *     job":** a card that has a pad state uses the pad state; every other content card uses this.
 *     Giving a pad card a second collapse control would put two affordances with two storage
 *     backings on one card.
 *   - **`CardId` is a hand-maintained union, and that is the validation.** Nothing derives it and
 *     nothing widens it at runtime, so a typo is a compile error rather than a card that silently
 *     never remembers. Adding a card means adding its id here AND mounting the toggle at its call
 *     site; there is deliberately no "collapse anything by string key" escape hatch.
 *   - **What is deliberately absent, so the gaps read as decisions rather than an unfinished
 *     sweep.** (a) `HintCard` and `StarterCard`: one glanceable block each, whose whole job is to
 *     be read once, and both already have an "X" — a chevron on top of a dismiss is two ways to
 *     make the same thing go away. (b) Rows — a row is not a card, and `components/TaskCard.tsx`
 *     already expands in place. (c) `components/OpenEpisodeCard.tsx`: a two-button prompt with
 *     no body to fold, and "Still going" already dismisses it; folding it must never be
 *     mistakable for answering it. (d) `components/EnergyMeter.tsx`: a strip with its label
 *     inside the meter rather than a card header, so there is nothing left when it folds.
 *     (e) `HomeSharedCard` and `EnergyBalanceCard`, which are behind `SHARING_VISIBLE` and do not
 *     render at all today. (f) Shopping's monthly-list cards and To-do's per-day sections, which
 *     are drawn one per row of data — see the note on CARD_IDS.
 *   - **Every id is a SINGLETON card.** There is no per-list or per-day collapse, and adding one
 *     is a real design question rather than a longer union: an id derived from a list id or a
 *     date accumulates entries for rows that no longer exist, and the "the union IS the
 *     validation" property below stops holding the moment ids are built at runtime.
 *   - Sanitized on read, never trusted: an unknown id or a non-boolean value is dropped, so a bag
 *     from an older build or a hand-edited backup falls back to that card's resting state rather
 *     than to a stored value nothing here understands. **This used to say a bad entry "can only
 *     ever leave a card OPEN", and that stopped being true when the default inverted** — a
 *     dropped entry now lands wherever lib/cardRegistry.ts puts that card, which for most cards
 *     is closed. What still holds is that nothing disappears: a folded card keeps its header,
 *     its count and its chevron, so it is one tap from its content either way.
 *   - Not in `lib/aiSetupGuide.ts`'s settings whitelist (an AI-authored file must not be able to
 *     hide the app's surfaces), so no `AI_SETUP_SCHEMA_VERSION` bump. Not in `lib/liveSync.ts`'s
 *     `SyncTable` either: how you folded your own cards is device-local, the same reasoning that
 *     keeps `app_meta`'s view snapshots out of it.
 */

import { CARDS, CARD_KEYS, CardKey, cardSpec } from '@/lib/cardRegistry';

/**
 * Every card that can be folded away, by id — **derived from lib/cardRegistry.ts**, not
 * hand-maintained.
 *
 * It was a hand-written union until 2026-08-21, on the reasoning that "the union IS the
 * validation". It was, and it validated the wrong thing: it caught a typo and could not catch a
 * card that simply never asked to be foldable, which is how the app ended up with three fold
 * mechanisms and a tab of cards where only some folded. The registry declares `fold` per card,
 * so a card that does not fold has to say so IN WRITING there.
 *
 * Ids are STORAGE KEYS — they are written into the settings column, so renaming one silently
 * re-opens that card for everyone who had collapsed it. See the registry's own note about the
 * `plans*` → `todo*` rename and the migration that came with it.
 */
export const CARD_IDS = CARD_KEYS.filter((k) => cardSpec(k).fold === 'persisted') as readonly CardId[];

/** A card that can be folded away. Derived: the registry keys with `fold: 'persisted'`. */
export type CardId = { [K in CardKey]: (typeof CARDS)[K]['fold'] extends 'persisted' ? K : never }[CardKey];

/**
 * The stored shape: only cards the user has moved OFF their resting state are present, so an
 * absent id means "however the registry's `openAtRest` draws this card".
 */
export type CollapsedCards = Partial<Record<CardId, boolean>>;

/** Whether a card is folded away when the user has chosen nothing for it. */
export function defaultCollapsed(id: CardId): boolean {
  return !cardSpec(id).openAtRest;
}

function isCardId(raw: string): raw is CardId {
  return (CARD_IDS as readonly string[]).includes(raw);
}

/**
 * Whether a card is currently folded away. Absent → that card's resting state, which is what
 * makes `{}` (the column's default) mean "the app as it is designed to open".
 */
export function isCollapsed(collapsed: CollapsedCards | undefined, id: CardId): boolean {
  const stored = collapsed?.[id];
  return typeof stored === 'boolean' ? stored : defaultCollapsed(id);
}

/**
 * Set one card's state, returned as a new object for `settings.update`.
 *
 * Returning a card to its RESTING state deletes the key rather than storing the value. The bag
 * is then exactly "the cards the user has moved" at all times — so it stays small, `{}` keeps
 * meaning "the app as designed" however much the user has fiddled, and a card whose default
 * later changes follows the new one for everybody who never had an opinion about it.
 */
export function withCollapsed(
  collapsed: CollapsedCards | undefined,
  id: CardId,
  next: boolean,
): CollapsedCards {
  const out: CollapsedCards = { ...(collapsed ?? {}) };
  if (next === defaultCollapsed(id)) delete out[id];
  else out[id] = next;
  return out;
}

/**
 * Drop anything unrecognised. Applied when reading the column, so a bad entry falls back to that
 * card's resting state — see the edit notes.
 *
 * A stored value that MATCHES the resting state is dropped too, which keeps the invariant
 * `withCollapsed` maintains true for a bag that reached us from an older build or a backup.
 */
export function sanitizeCollapsedCards(raw: unknown): CollapsedCards {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CollapsedCards = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'boolean' || !isCardId(key)) continue;
    if (value === defaultCollapsed(key)) continue;
    out[key] = value;
  }
  return out;
}
