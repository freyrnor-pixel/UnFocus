/**
 * money.ts — locale-aware NOK currency formatting.
 *
 * The app is Norwegian-first but bilingual. Norwegian writes the decimal
 * separator as a comma (`123,50 kr`) while English uses a period (`123.50 kr`).
 * `.toFixed(n)` always emits a period, so fractional prices rendered inline
 * (`${x.toFixed(2)} kr`) showed the wrong separator for Norwegian users.
 * `formatKr()` centralises this: it formats the amount with the requested
 * number of decimals, swaps in the active language's decimal separator, and
 * appends the `kr` suffix.
 *
 * Connections:
 *   Imports → store/useSettingsStore (reads current language)
 *   Used by → app/budget.tsx, app/scan.tsx (fractional price displays)
 *   Data    → none (pure formatting; reads language from the settings store)
 *
 * Edit notes:
 *   - Not a hook — safe to call from anywhere. Pass `lang` explicitly to avoid
 *     the store read (e.g. inside notification schedulers).
 *   - Thousands separators are intentionally not applied (grocery-scale
 *     amounts); only the decimal separator is localised, which is the actual
 *     bilingual bug this fixes.
 */
import { useSettingsStore } from '@/store/useSettingsStore';
import type { Language } from '@/store/useSettingsStore';

/** Format an amount as localised NOK, e.g. `123,50 kr` (no) / `123.50 kr` (en). */
export function formatKr(amount: number, decimals = 2, lang?: Language): string {
  const language = lang ?? useSettingsStore.getState().language;
  const fixed = amount.toFixed(decimals);
  const localized = language === 'no' ? fixed.replace('.', ',') : fixed;
  return `${localized} kr`;
}
