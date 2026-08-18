/**
 * shoppingStarters.ts — the one-tap "bundles" behind the shopping quick-add tray (2026-08-20).
 *
 * A bundle is a short, named set of items a household buys together, appended to whichever
 * week list you are looking at in one tap — so a list can be started without typing. Same
 * shape as lib/habitStarters.ts and lib/goalStarters.ts: the STRUCTURE lives here, the
 * user-facing bundle titles live under `shoppingStarters.*` in lib/i18n.ts, and a test pins
 * that the two agree.
 *
 * Connections:
 *   Imports → nothing. Dependency-free on purpose (same rule as lib/cardLayout.ts) so it can
 *             be read from a render path without dragging a store or the DB in.
 *   Used by → components/WeekListCard.tsx (the quick-add tray), lib/__tests__/shoppingStarters.test.ts
 *   Data    → none. The caller writes through useShoppingStore.add(), which owns dedup + sync.
 *
 * Edit notes:
 *   - **Item names are NORWEGIAN in every language**, and that is the repo's existing
 *     convention rather than an oversight — the catalogue (lib/catalogSeed.ts, ~287 names),
 *     the 36 seeded symptoms and the dish seed all do the same: "only UI follows the user's
 *     language". An English user already reads Norwegian item names on the Catalogue tab. The
 *     bundle TITLES are translated, because those are the app talking.
 *   - **Every `category` must be a member of `CATEGORY_VALUES`** (lib/shoppingCategories.ts).
 *     Not imported here — that would cost this module its dependency-free property for a
 *     constraint a test can check just as well, which is what
 *     lib/__tests__/shoppingStarters.test.ts does.
 *   - **Names should exist in lib/catalogSeed.ts where possible.** A name the catalogue knows
 *     gets its price and category filled in by the typeahead everywhere else in the app, so a
 *     bundle item that matches one reads as an ordinary row rather than a stranger. The test
 *     asserts this and is the reason to check a new name against the seed before adding it.
 *   - **No prices here.** A bundle says WHAT, never what it costs — a price belongs to the
 *     catalogue row, and duplicating it would give the app two answers that drift apart.
 *   - **Keep bundles SHORT.** These are a way to skip typing, not a pre-made shop; a bundle
 *     long enough to need editing down has cost more than it saved. Six items is the cap the
 *     test enforces.
 *   - There is deliberately no "most bought" bundle derived from history. `purchase_log` is
 *     written only by receipt scanning (app/scan.tsx), so for anyone who does not scan it is
 *     empty — a tray whose contents depend on a feature you may never have used is worse than
 *     one that is simply the same every time.
 */

/** One item in a bundle. `amount` is a string everywhere in the shopping layer. */
export type StarterItem = { name: string; category: string };

export type ShoppingStarter = {
  /** Stable id — also the i18n key under `shoppingStarters.*`. Never renamed. */
  id: string;
  items: readonly StarterItem[];
};

/** The most items a bundle may carry. See the header's "keep bundles SHORT" note. */
export const MAX_STARTER_ITEMS = 6;

export const SHOPPING_STARTERS: readonly ShoppingStarter[] = [
  {
    id: 'basics',
    items: [
      { name: 'Helmelk 1L', category: 'dairy' },
      { name: 'Grovbrød', category: 'bakery' },
      { name: 'Egg 18pk M Prima Lavpris', category: 'dairy' },
      { name: 'Smør', category: 'dairy' },
      { name: 'Kaffe malt', category: 'pantry' },
    ],
  },
  {
    id: 'fruitVeg',
    items: [
      { name: 'Epler', category: 'produce' },
      { name: 'Gulrot 1kg Prima', category: 'produce' },
      { name: 'Rødløk', category: 'produce' },
      { name: 'Potet', category: 'produce' },
      { name: 'Tomater', category: 'produce' },
    ],
  },
  {
    id: 'cleaning',
    items: [
      { name: 'Oppvaskmiddel', category: 'cleaning' },
      { name: 'Kjøkkenrull', category: 'cleaning' },
      { name: 'Toalettpapir', category: 'cleaning' },
      { name: 'Vaskemiddel', category: 'cleaning' },
    ],
  },
] as const;
