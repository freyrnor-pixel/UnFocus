/**
 * scanTarget.ts — what a receipt scan is FOR, and how its lines land.
 *
 * `/scan` used to have no target at all: it read one param (`autoCapture`) and every confirmed
 * line became a brand-new `status: 'inWeeklyList'` row with no `listId`, regardless of where
 * you had opened it from. That made "scan a receipt" mean "add all of this again", which is
 * the opposite of what you want holding a receipt for a shop you have just done.
 *
 * Maintainer (2026-08-13): *"Shopping list Scan means match against this shopping list, same
 * logic for Monthly, and in catalogue it means Add/update."* So a scan now has a target:
 *
 *   'weekly' | 'monthly'  MATCH. A scanned line that already exists on the target list is a
 *                         confirmation of that row (tick it off, correct its price), not a new
 *                         row. Only lines with no counterpart are additions.
 *   'catalogue'           ADD/UPDATE. Nothing is written to any shopping list; the scan only
 *                         teaches the catalogue names and prices.
 *
 * Connections:
 *   Imports → lib/receipt (findFuzzyMatch — the same matcher the scan screen already used to
 *             raise catalog prices, so a name matches identically everywhere)
 *   Used by → app/scan.tsx
 *   Data    → none. Pure: rows in, a classification out. The caller owns every write.
 *
 * Edit notes:
 *   - **Pure and dependency-free (bar the matcher) on purpose.** `app/scan.web.tsx` is an OCR
 *     placeholder and `scripts/preview.mjs` deliberately doesn't walk Scan, so NOTHING about
 *     this feature is reachable in the web preview — a device is the only way to exercise the
 *     screen. Keeping the decision-making in a pure function is what makes it testable at all;
 *     see lib/__tests__/scanTarget.test.ts. Don't move this logic back into the component.
 *   - **A price only ever RISES on the catalogue** (`shouldRaisePrice`), which predates this
 *     module and is deliberate: a receipt is evidence of what something cost once, and an
 *     offer price shouldn't overwrite a known regular price. The maintainer flagged
 *     "add/update" for the catalogue target — that means adding unknown NAMES and raising
 *     known prices, and lowering is a separate decision that has not been made. Don't quietly
 *     add it here.
 *   - `matchScanToList` is order-preserving and never mutates its inputs; the caller renders
 *     the result as the review list, so a stable order matters.
 */
import { findFuzzyMatch } from '@/lib/receipt';

/** Where a scan was launched from, and therefore what its lines mean. */
export type ScanTarget = 'weekly' | 'monthly' | 'catalogue';

const TARGETS: readonly ScanTarget[] = ['weekly', 'monthly', 'catalogue'];

/**
 * Read a `target` route param. Anything unrecognised — including absent — falls back to
 * 'weekly', which is what an untargeted scan did before this existed, so an old deep link or a
 * hand-typed URL behaves exactly as it used to rather than erroring.
 */
export function parseScanTarget(raw: string | undefined): ScanTarget {
  return TARGETS.includes(raw as ScanTarget) ? (raw as ScanTarget) : 'weekly';
}

/** True when this target writes to a shopping list at all. */
export function targetWritesToList(target: ScanTarget): boolean {
  return target !== 'catalogue';
}

/** A row already on the list being scanned against. */
export type ListRow = { id: string; name: string; price: number };

/** One scanned line, classified against the target list. */
export type ScanMatch<T> = {
  item: T;
  /** The existing row this line confirms, or null when it is genuinely new. */
  matchedId: string | null;
  /** The scanned price, when it is worth writing over the matched row's. */
  newPrice: number | null;
};

/**
 * Classify scanned lines against the rows already on the target list.
 *
 * A match means "you have this on your list and you just bought it" — the caller ticks that
 * row off and corrects its price, rather than adding a second copy. `matchedId` null means the
 * line is an addition.
 */
export function matchScanToList<T extends { name: string; price: number }>(
  scanned: readonly T[],
  existing: readonly ListRow[]
): ScanMatch<T>[] {
  const names = existing.map((r) => r.name);
  // One id per matched row, so two scanned lines that fuzzy-match the SAME list row don't both
  // claim it — the second is an addition. Buying two of something is two lines on a receipt and
  // one row on a list; silently collapsing them would tick the row off and lose the second.
  const claimed = new Set<string>();
  return scanned.map((item) => {
    const match = findFuzzyMatch(item.name, names);
    const row = match ? existing.find((r) => r.name === match) : undefined;
    if (!row || claimed.has(row.id)) return { item, matchedId: null, newPrice: null };
    claimed.add(row.id);
    return {
      item,
      matchedId: row.id,
      // Correct the stored price in EITHER direction here, unlike the catalogue: this is the
      // price of the thing you just put in your basket, on the list you were shopping from.
      newPrice: item.price > 0 && item.price !== row.price ? item.price : null,
    };
  });
}

/**
 * Whether a scanned price should overwrite a catalogue price. Only upward — see the Edit note.
 */
export function shouldRaisePrice(scannedPrice: number, storedPrice: number): boolean {
  return scannedPrice > storedPrice;
}
