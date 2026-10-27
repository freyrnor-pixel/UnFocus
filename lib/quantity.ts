/**
 * quantity.ts — pure amount + unit parsing and merging for shopping rows (2026-10-26).
 *
 * **Why it exists.** `useShoppingStore.add()` consolidated a re-added item by NAME alone and
 * summed amounts with `parseInt`, so "Melk 1 l" + "Melk 5 dl" became "6 l", "0.5" became 1 and
 * the Norwegian "1,5" became 1. Mealie (`shopping_lists.py: can_merge`) only merges two lines
 * whose units are the same or convertible, and converts into the existing line's unit; this file
 * is that rule, sized for a one-person grocery list: mass (g/kg), volume (ml/cl/dl/l) and plain
 * counts ('' / stk). Anything else merges only with the exact same unit text.
 *
 * Connections:
 *   Imports → none (pure)
 *   Used by → store/useShoppingStore.ts (add() + mergeDuplicateItems() dedupe),
 *             lib/dishToList.ts (ingredient amount → catalog targetQuantity),
 *             lib/__tests__/quantity.test.ts
 *   Data    → none
 */

type Family = 'mass' | 'volume' | 'count';

/** Factor to the family's base unit (g, ml, piece). Keys are normalised unit text. */
const UNITS: Record<string, { family: Family; factor: number }> = {
  '': { family: 'count', factor: 1 },
  stk: { family: 'count', factor: 1 },
  g: { family: 'mass', factor: 1 },
  gram: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  cl: { family: 'volume', factor: 10 },
  dl: { family: 'volume', factor: 100 },
  l: { family: 'volume', factor: 1000 },
  liter: { family: 'volume', factor: 1000 },
};

/** Lower-case, trimmed, trailing '.' dropped ("Stk." → "stk"). */
export function normalizeUnit(unit: string | undefined | null): string {
  return (unit ?? '').trim().toLowerCase().replace(/\.$/, '');
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/**
 * The number in a typed amount, or null when there is none. Accepts "2", "1,5", "0.5", "½",
 * "1½", "1/2" and "1 1/2". A leading number followed by text ("2 pk") reads as 2.
 */
export function parseAmount(raw: string | undefined | null): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let n: number;
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  const frac = s.match(/^(\d+)\/(\d+)/);
  const glyph = s.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])/);
  const plain = s.match(/^\d+(?:[.,]\d+)?/);
  if (mixed) n = Number(mixed[2]) / Number(mixed[3]) + Number(mixed[1]);
  else if (frac) n = Number(frac[1]) / Number(frac[2]);
  else if (glyph) n = (glyph[1] ? Number(glyph[1].replace(',', '.')) : 0) + FRACTIONS[glyph[2]];
  else if (plain) n = Number(plain[0].replace(',', '.'));
  else return null;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Up to two decimals, no trailing zeros, with the decimal separator the user typed. */
export function formatAmount(n: number, sep: '.' | ',' = '.'): string {
  const s = String(Math.round(n * 100) / 100);
  return sep === ',' ? s.replace('.', ',') : s;
}

/** Can two lines with these units be added together? */
export function unitsCompatible(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = normalizeUnit(a);
  const nb = normalizeUnit(b);
  if (na === nb) return true;
  const ua = UNITS[na];
  const ub = UNITS[nb];
  return !!ua && !!ub && ua.family === ub.family;
}

/**
 * `into` + `add`, expressed in `into`'s unit (the existing row wins, as in Mealie), or null when
 * the units can't be added. An amount with no number counts as 1, matching the old behaviour
 * for a bare "Melk" row.
 */
export function mergeAmounts(
  into: { amount: string; unit: string },
  add: { amount: string; unit: string },
): { amount: string; unit: string } | null {
  if (!unitsCompatible(into.unit, add.unit)) return null;
  const a = parseAmount(into.amount) ?? 1;
  const b = parseAmount(add.amount) ?? 1;
  const ua = UNITS[normalizeUnit(into.unit)];
  const ub = UNITS[normalizeUnit(add.unit)];
  const bInA = ua && ub ? (b * ub.factor) / ua.factor : b;
  const sep = into.amount.includes(',') || (!into.amount.includes('.') && add.amount.includes(',')) ? ',' : '.';
  return { amount: formatAmount(a + bInA, sep), unit: into.unit };
}

/** A whole, positive count for a catalog row's targetQuantity ("1,5" → 2, "" → 1). */
export function amountToCount(raw: string | undefined | null): number {
  const n = parseAmount(raw);
  return n === null ? 1 : Math.max(1, Math.round(n));
}
