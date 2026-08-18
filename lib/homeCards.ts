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
 *   - **The 2026-08-20 5→3 merge folded 'habits' into 'plans' is REVERSED by the SAME-DAY
 *     "full-screen card expansion" pass.** Habits is a first-class card again
 *     (components/HomeHabitsCard.tsx, `embedded={false}`) — it is no longer a section inside
 *     PlanTaskCard's `extraSection`. 'health' is NEW in the same pass: Health left the bottom
 *     nav and became a Home card too (components/HomeHealthCard.tsx). The fold-in logic below
 *     is now the MIRROR of what it was: a stored order that still has 'habits' folded away
 *     (i.e. 2 <= this build ago) needs it split back OUT, not merged further in.
 */

/**
 * The reorderable, removable Home cards, in default order.
 *
 * 'goals' was dropped 2026-07-29 (user report: Home had too many lists) and needs no handling
 * — the filter below drops it for free. 'habits' and 'health' both need handling on read: see
 * `sanitizeHomeCardOrder`'s doc.
 */
export const HOME_CARD_KINDS = ['plans', 'habits', 'notes', 'shopping', 'health'] as const;

export type HomeCardKind = (typeof HOME_CARD_KINDS)[number];

/**
 * Defensive parse for the persisted order: drop unknown and duplicate kinds, fall back to the
 * default order if nothing survives (a corrupt or legacy row).
 *
 * **It also un-folds a stored order from the 2026-08-20→2026-08-20 window, when 'habits' had
 * been folded into 'plans'.** A row written during that window (or by an older build, or
 * restored from a backup, or synced from a paired device still on it) has no 'habits' entry at
 * all — filtering alone would leave the card simply absent, with nothing on screen suggesting
 * it still exists. So a 'habits'-less order that DOES contain 'plans' gets 'habits' spliced in
 * directly after it (mirroring how it read when it was a section of that card) — but only when
 * 'habits' is genuinely missing, never when the user has already reordered or removed it
 * themselves post-un-fold. 'health' needs no equivalent handling: it is simply a NEW kind, and
 * the unknown-kind filter already treats "never seen this key" as "append via the fallback",
 * which is the correct behaviour for something that didn't exist to lose.
 *
 * Doing it on READ (rather than a one-shot `lib/db.ts` migration) covers a row written by an
 * OLDER build after the migration would have run: a restored backup, or a paired device still
 * on the previous version.
 */
export function sanitizeHomeCardOrder(order: string[]): HomeCardKind[] {
  const seen = new Set<string>();
  const clean = order.filter((k): k is HomeCardKind => {
    if (seen.has(k) || !(HOME_CARD_KINDS as readonly string[]).includes(k)) return false;
    seen.add(k);
    return true;
  });
  const withHabits = clean.includes('habits')
    ? clean
    : clean.includes('plans')
      ? clean.flatMap((k): HomeCardKind[] => (k === 'plans' ? ['plans', 'habits'] : [k]))
      : clean;
  return withHabits.length > 0 ? withHabits : [...HOME_CARD_KINDS];
}
