/**
 * collate.ts — one alphabetical order for every name list in the app.
 *
 * Five places sort user-visible names (the catalogue, symptoms, both typeaheads, and the
 * shop-walk category sort). All five hardcoded `localeCompare(…, 'no')`, for a good reason
 * that is written down in lib/typeahead.ts: Norwegian sorts æ, ø, å AFTER z, while the
 * default locale interleaves them with a/o and puts "Ærfugl" between "A" and "B".
 *
 * Icelandic (2026-08-15) needs the same courtesy for a different alphabet: þ sorts after z,
 * ð directly after d, and ö at the very end. Under Norwegian collation an Icelandic user's
 * own "Þorskur" lands between T and U and "Ðe…" nowhere near D — the same bug the 'no'
 * argument was added to fix, just for the other set of letters. So the LOCALE follows the
 * user's language, and everything else about the ordering stays exactly as it was.
 *
 * English keeps Norwegian collation deliberately, and that is not an oversight: the seeded
 * catalogue, dish and symptom names are Norwegian in every language (lib/catalogSeed.ts's
 * "only UI follows the user's language"), so an English user is reading a Norwegian list and
 * wants it in Norwegian order.
 *
 * Connections:
 *   Imports → store/useSettingsStore (reads current language; type-only in the pure paths)
 *   Used by → lib/typeahead.ts, lib/shoppingCategories.ts, store/useCatalogStore.ts,
 *             store/useHealthStore.ts, lib/__tests__/collate.test.ts
 *   Data    → none (pure comparison; reads `language` from the settings store)
 *
 * Edit notes:
 *   - Not a hook. Pass `lang` explicitly from anywhere that already has it; the store read
 *     is the convenience path for the sort sites that don't.
 *   - **Sorted results are cached in store arrays**, computed once at `load()` and maintained
 *     by the mutation methods (see useCatalogStore's load() note on why it is not re-sorted
 *     per mount). Switching language therefore re-orders a list at the next store load, not
 *     mid-session. That is deliberate: re-sorting 287 catalogue rows on a settings toggle
 *     buys an ordering nobody is looking at, and every store reloads on cold start anyway.
 *   - Keep the locale mapping here and nowhere else. A bare `localeCompare()` at a call site
 *     silently reverts both languages to the default locale.
 */
import { useSettingsStore } from '@/store/useSettingsStore';
import type { Language } from '@/store/useSettingsStore';

/**
 * The ICU locale used to order names, per app language. Icelandic gets its own; Norwegian
 * and English share Norwegian order (see the header for why English is not `en`).
 */
export function collationLocale(lang: Language): string {
  return lang === 'is' ? 'is' : 'no';
}

/** The active language's collation locale, read from the settings store. */
export function currentCollationLocale(): string {
  return collationLocale(useSettingsStore.getState().language);
}

/**
 * Compare two names in the active language's alphabetical order. Pass `locale` (from
 * `collationLocale`) when sorting a whole list, so the store read happens once rather than
 * once per comparison.
 */
export function compareNames(a: string, b: string, locale?: string): number {
  return a.localeCompare(b, locale ?? currentCollationLocale());
}
