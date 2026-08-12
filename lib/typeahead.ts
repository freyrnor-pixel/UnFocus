/**
 * typeahead.ts — how a name-suggestion list is ordered.
 *
 * One rule, shared by the two typeaheads in the app: entries that START with what the user
 * typed come first, and everything else is alphabetical. "melk" typed into the shopping
 * catalogue should offer "Melk" before "Havremelk", even though both match.
 *
 * The comparator was byte-identical in store/useCatalogStore.ts's and store/useHealthStore.ts's
 * `suggest()` before 2026-08-12. Only the comparator is shared: the two differ in what they
 * filter (the catalogue de-duplicates on lowercased name, symptoms don't) and that stays
 * each store's own business.
 *
 * Connections:
 *   Imports → —
 *   Used by → store/useCatalogStore.ts, store/useHealthStore.ts,
 *             lib/__tests__/typeahead.test.ts
 *   Data    → none (pure)
 *
 * Edit notes:
 *   - **`localeCompare(…, 'no')` is deliberate and must not become a bare `localeCompare()`.**
 *     Norwegian sorts æ, ø, å after z; the default locale interleaves them with a/o, which
 *     puts "Ærfugl" between "A" and "B" in a list a Norwegian user is scanning.
 *   - The prefix test is done on an already-lowercased query — callers pass `query` after
 *     `trim().toLowerCase()`, matching how both stores computed it.
 */

/**
 * Sort comparator for name suggestions: prefix matches first, then Norwegian alphabetical.
 *
 * @param query The user's input, already trimmed and lowercased.
 */
export function byPrefixThenName<T extends { name: string }>(query: string): (a: T, b: T) => number {
  return (a, b) => {
    const ap = a.name.toLowerCase().startsWith(query) ? 0 : 1;
    const bp = b.name.toLowerCase().startsWith(query) ? 0 : 1;
    return ap !== bp ? ap - bp : a.name.localeCompare(b.name, 'no');
  };
}
