/**
 * receipt.ts — parse OCR'd receipt text into priced line items.
 *
 * Pure text→items parser extracted from app/scan.tsx so it can be unit tested
 * and reused. Skips totals/payment/metadata lines and keeps lines containing a
 * NN[.,]NN price; the item name is whatever remains once the price is stripped.
 * Items default to `selected: true` because the user always reviews them before
 * anything is added. Also exports a small Levenshtein helper + fuzzy-match
 * finder used by app/scan.tsx to silently update Katalog item prices.
 *
 * Connections:
 *   Imports → —
 *   Used by → app/scan.tsx
 *   Data    → none (pure functions)
 *
 * Edit notes:
 *   - Tune skipPatterns/pricePattern if OCR accuracy drops for new store formats.
 *   - findFuzzyMatch is case-insensitive substring-or-close-edit-distance; threshold
 *     is intentionally conservative (distance <= 2 for short names) so it doesn't
 *     silently overwrite the price of an unrelated item.
 */
export type ParsedReceiptItem = { name: string; price: number; selected: boolean; category?: string };

/** Classic iterative Levenshtein edit distance between two strings (case-sensitive). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Finds the best fuzzy match for `name` among `candidateNames`, using a
 * case-insensitive substring check first, falling back to Levenshtein distance
 * (<= 2 for names up to ~12 chars, scaling slightly for longer names). Returns
 * the matching candidate string, or null if nothing is close enough.
 */
export function findFuzzyMatch(name: string, candidateNames: string[]): string | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  for (const c of candidateNames) {
    const cl = c.toLowerCase();
    if (cl === target || cl.includes(target) || target.includes(cl)) return c;
  }
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidateNames) {
    const cl = c.toLowerCase();
    const dist = levenshtein(target, cl);
    const threshold = Math.max(2, Math.floor(Math.max(target.length, cl.length) * 0.2));
    if (dist <= threshold && dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

export function parseReceiptText(text: string): ParsedReceiptItem[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ParsedReceiptItem[] = [];
  const pricePattern = /(\d+[.,]\d{2})/;
  const skipPatterns = /^(total|sum|mva|betalt|visa|mastercard|kvittering|dato|kl\.|kr|nok)/i;
  for (const line of lines) {
    if (skipPatterns.test(line)) continue;
    const priceMatch = line.match(pricePattern);
    if (!priceMatch) continue;
    const price = parseFloat(priceMatch[1].replace(',', '.'));
    const name = line.replace(pricePattern, '').replace(/\s+/g, ' ').trim();
    if (name.length < 2) continue;
    items.push({ name, price, selected: true });
  }
  return items;
}
