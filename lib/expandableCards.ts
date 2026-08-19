/**
 * expandableCards.ts — which cards can grow to fill the screen, as a hand-maintained union.
 *
 * Maintainer instruction (2026-08-20, "Full-screen card expansion"): replace pushing a
 * different screen (Home's Notes title → /notes, Shopping's Food/Catalogue drawers → /food,
 * /catalogue, Home's To-do card → /plans) with EXPANSION IN PLACE — a card grows to fill the
 * screen and shrinks back, so the same content never lives in two layouts and moving between
 * them is not a page change.
 *
 * Dependency-free on purpose, same discipline as lib/collapsedCards.ts and lib/cardLayout.ts:
 * this is evaluated in the render path of every card that can expand, so it must not be able to
 * reach a store, the DB, the notification layer or the sync layer.
 * `lib/__tests__/expandableCards.test.ts` source-scans it for exactly that.
 *
 * Connections:
 *   Imports → nothing
 *   Used by → lib/useCardExpand.ts, components/CardExpandButton.tsx, components/CardExpandHost.tsx
 *   Data    → none — expansion is NOT persisted. See the edit note below.
 *
 * Edit notes:
 *   - **This is a FOURTH card axis, and deliberately not a widening of an existing one.** The
 *     repo already has three: lib/cardLayout.ts (how much DETAIL a row shows), lib/padState.ts
 *     (HOW MANY rows are drawn) and lib/collapsedCards.ts (whether the body is drawn AT ALL).
 *     This is whether the card is drawn at CARD size or SCREEN size. Widening `CardId` would
 *     imply e.g. Shop's Catalogue card is foldable, which it is not — so this gets its own id
 *     union instead.
 *   - **Not persisted, and that is deliberate.** A collapse survives relaunch because it is a
 *     standing preference; an expansion is a momentary state — restoring the app into a
 *     full-screen card the user does not remember opening would be a worse first frame than the
 *     ordinary card stack. No SQLite column, no `SyncTable` entry, no `SETTINGS_WHITELIST`
 *     entry, no `AI_SETUP_SCHEMA_VERSION` bump.
 *   - **`EXPANDABLE_CARD_IDS` is a hand-maintained union, and every entry is a SINGLETON** — the
 *     same property `CARD_IDS` relies on, for the same reason: a typo is a compile error rather
 *     than a card that silently never expands. There is deliberately no per-list or per-day id
 *     (mirrors `CARD_IDS`'s own rule) — the Week card's per-weekday sections and Shop's monthly
 *     list cards get no expand id of their own, only their parent card does.
 */

export const EXPANDABLE_CARD_IDS = [
  'shopLists',
  'shopDishes',
  'shopCatalogue',
  // The Me tab's three cards. `homeTodo` and `homeShopping` were here until 2026-08-19 and are
  // GONE, not deferred: the To-do and Shopping preview cards left that screen when To-do took
  // the middle tab, so there is no card left for either id to belong to. An id whose card does
  // not exist is worse than no id — it keeps a `CARD_BODIES` entry alive that nothing can ever
  // reach, and the test that pins the two lists together goes on passing over it.
  'homeHabits',
  'homeNotes',
  'homeHealth',
  'todoWhenever',
  'todoToday',
  'todoWeek',
  'todoRecurring',
] as const;

/** A card that can grow to fill the screen. See EXPANDABLE_CARD_IDS. */
export type ExpandableCardId = (typeof EXPANDABLE_CARD_IDS)[number];

export function isExpandableCardId(raw: string): raw is ExpandableCardId {
  return (EXPANDABLE_CARD_IDS as readonly string[]).includes(raw);
}

/** The measured rect an expansion animates from/to — window coordinates, from measureInWindow. */
export type ExpandRect = { x: number; y: number; width: number; height: number };
