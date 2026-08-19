/**
 * collapsedCards.ts — which content cards the user has folded away, as pure functions.
 *
 * Maintainer, 2026-08-14: *"Every card should be collapsable"*, and remembered across launches.
 * A collapsed card keeps its header and its chevron and draws nothing else; nothing about it is
 * unloaded, disabled or deferred — same presentation-only contract lib/cardLayout.ts has.
 *
 * Dependency-free on purpose, like lib/cardLayout.ts, lib/padState.ts and lib/growth.ts: this is
 * evaluated in the render path of every tab, so it must not be able to reach a store, the DB, the
 * notification layer or the sync layer. `lib/__tests__/collapsedCards.test.ts` source-scans it for
 * exactly that. The hook that DOES touch the store is lib/useCollapsedCard.ts, and the shared
 * chevron is components/CardCollapseToggle.tsx.
 *
 * Connections:
 *   Imports → nothing
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
 *     from an older build or a hand-edited backup can only ever leave a card OPEN. Failing toward
 *     visible is the point — a card the user cannot find is worse than one they must re-collapse.
 *   - Not in `lib/aiSetupGuide.ts`'s settings whitelist (an AI-authored file must not be able to
 *     hide the app's surfaces), so no `AI_SETUP_SCHEMA_VERSION` bump. Not in `lib/liveSync.ts`'s
 *     `SyncTable` either: how you folded your own cards is device-local, the same reasoning that
 *     keeps `app_meta`'s view snapshots out of it.
 */

/**
 * Every card that can be folded away, by id.
 *
 * Ids are STORAGE KEYS — they are written into the settings column, so renaming one silently
 * re-opens that card for everyone who had collapsed it. Prefer adding to this list over
 * renaming; if a rename is unavoidable, it needs a migration like any other stored value.
 *
 * Grouped by the screen that draws them, which is also the order they appear on it.
 */
export const CARD_IDS = [
  // To-do — the three named sections. The per-day and per-group SectionCards on the same screen
  // are deliberately absent: they are generated from data, so they have no stable id to store,
  // and a bag keyed by date would grow forever.
  'plansToday',
  'plansWhenever',
  'plansRecurring',
  // The Week card folds as ONE thing — the seven weekday sections inside it are the
  // data-generated ones the rule above excludes, and folding them one at a time was the only
  // way to put the week away (2026-08-19, maintainer: "Mon-sun should also be collapsable
  // together"). This id is the card, never a day.
  'plansWeek',
  // Habits — the whole list card, composer included.
  'habitsList',
  // Health
  'healthWeek',
  'healthMedicine',
] as const;

/** A card that can be folded away. See CARD_IDS. */
export type CardId = (typeof CARD_IDS)[number];

/** The stored shape: only collapsed cards are present, so an absent id means open. */
export type CollapsedCards = Partial<Record<CardId, boolean>>;

function isCardId(raw: string): raw is CardId {
  return (CARD_IDS as readonly string[]).includes(raw);
}

/**
 * Whether a card is currently folded away. Absent → open, which is what makes `{}` (the
 * column's default, and every existing install) mean "everything as it was".
 */
export function isCollapsed(collapsed: CollapsedCards | undefined, id: CardId): boolean {
  return collapsed?.[id] === true;
}

/**
 * Set one card's state, returned as a new object for `settings.update`.
 *
 * Expanding DELETES the key rather than storing `false`. The bag is then exactly "the cards that
 * are folded away" at all times — so it stays small, `{}` keeps meaning "nothing is collapsed"
 * however much the user has fiddled, and a future id can never collide with a stale `false`.
 */
export function withCollapsed(
  collapsed: CollapsedCards | undefined,
  id: CardId,
  next: boolean,
): CollapsedCards {
  const out: CollapsedCards = { ...(collapsed ?? {}) };
  if (next) out[id] = true;
  else delete out[id];
  return out;
}

/**
 * Drop anything unrecognised. Applied when reading the column, so a bad entry can only ever
 * leave a card open — see the edit notes on why that is the safe direction.
 */
export function sanitizeCollapsedCards(raw: unknown): CollapsedCards {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CollapsedCards = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value !== true || !isCardId(key)) continue;
    out[key] = true;
  }
  return out;
}
