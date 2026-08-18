/**
 * homeCards.ts — which preview cards "I dag" draws, and in what order.
 *
 * The kinds the Home screen can stack, plus the defensive parse for the persisted order
 * (`settings.homeCardOrder`, a JSON string array). Lifted out of app/(tabs)/index.tsx on
 * 2026-08-20 so the fold-in rule below can be unit-tested — it is a data migration, and its
 * failure mode is a user quietly losing a list they still have on screen.
 *
 * Connections:
 *   Imports → nothing. Dependency-free on purpose (same rule as lib/cardLayout.ts and
 *             lib/firstRunOptions.ts) — it is read on every Home render.
 *   Used by → app/(tabs)/index.tsx, components/HomeCardManager.tsx (via that screen),
 *             lib/__tests__/homeCards.test.ts
 *   Data    → none. store/useSettingsStore.ts owns the column; this only parses it.
 *
 * Edit notes:
 *   - **Order here is the DEFAULT order** — what a fresh install gets and what a corrupt or
 *     empty persisted value falls back to. Keep it in step with `defaultSettings.homeCardOrder`
 *     in store/useSettingsStore.ts, which a test pins.
 *   - **Removing a kind and MERGING a kind are different, and the difference is this file's
 *     whole reason to exist.** A removed card ('goals', 2026-07-29) needs nothing: unknown
 *     kinds are filtered, so it simply stops being drawn. A merged card needs its stored entry
 *     redirected, or the user loses the surface rather than seeing it in its new home.
 */

/**
 * The reorderable, removable Home cards, in default order.
 *
 * 'goals' was dropped 2026-07-29 (user report: Home had too many lists) and needs no handling
 * — the filter below drops it for free. 'habits' was dropped 2026-08-20 by the 5→3 tab merge
 * and DOES need handling: it was not deleted, it became a section inside the 'plans' card
 * (components/PlanTaskCard.tsx's `extraSection`).
 */
export const HOME_CARD_KINDS = ['plans', 'notes', 'shopping'] as const;

export type HomeCardKind = (typeof HOME_CARD_KINDS)[number];

/**
 * Defensive parse for the persisted order: drop unknown and duplicate kinds, fall back to the
 * default order if nothing survives (a corrupt or legacy row).
 *
 * **It also folds a stored `'habits'` into `'plans'`, and that is a migration done here rather
 * than in lib/db.ts.** For the ordinary user the plain unknown-kind filter would already give
 * the right answer, because 'plans' is in their order too and the habits section rides on it.
 * The case that needs the fold is the user who REMOVED the To-do card and kept Habits: filtering
 * alone would drop their habits list entirely, with the cards they still have showing no sign of
 * where it went. So 'habits' is promoted in the position it held, and only when 'plans' is
 * absent — otherwise it is a duplicate and the filter takes it.
 *
 * Doing it on READ also covers a row written by an OLDER build after the migration would have
 * run: a restored backup, or a paired device on the previous version. A one-shot `UPDATE` in
 * lib/db.ts runs once per install and would miss both.
 */
export function sanitizeHomeCardOrder(order: string[]): HomeCardKind[] {
  const merged =
    order.includes('habits') && !order.includes('plans')
      ? order.map((k) => (k === 'habits' ? 'plans' : k))
      : order;
  const seen = new Set<string>();
  const clean = merged.filter((k): k is HomeCardKind => {
    if (seen.has(k) || !(HOME_CARD_KINDS as readonly string[]).includes(k)) return false;
    seen.add(k);
    return true;
  });
  return clean.length > 0 ? clean : [...HOME_CARD_KINDS];
}
