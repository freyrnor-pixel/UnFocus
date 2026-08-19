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
 *     nav ENTIRELY and became a Home card (components/HomeHealthCard.tsx) — unlike 'goals'
 *     (2026-07-29), which had somewhere else to be (the app still worked without it), Health has
 *     no other surface left once it drops off the tab bar, so a stored order that predates this
 *     pass needs 'health' appended, the same way 'habits' needs splicing back in. Silently
 *     dropping it would take medicine trays and symptom tracking off screen for every existing
 *     install with no error and no empty state saying so. (An earlier version of this file
 *     argued the opposite — "health is a genuinely new surface, reachable via Add a card" — and
 *     shipped `sanitizeHomeCardOrder` withOUT the append. That did not hold: EVERY row in
 *     existence at the time predates this pass, so "don't auto-add" meant "nobody sees the
 *     Health card that used to be a whole tab" — caught by the web preview walk, not by the unit
 *     tests, which had asserted the intended behaviour instead of checking it against the actual
 *     all-installs-predate-it fact.) The fold-in logic below is now the MIRROR of what it was for
 *     'habits': a stored order that still has 'habits' folded away needs it split back OUT, not
 *     merged further in — and 'health' needs appending whenever it's missing, full stop.
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
 * themselves post-un-fold. **'health' needs handling too, and it is simpler**: it has no old
 * position to be spliced back next to (it was never part of another card), so a 'health'-less
 * order just gets it APPENDED at the end. Every row that exists at the moment this pass ships
 * predates 'health' by definition, so this is not an edge case — it is the ordinary path for
 * every install, exactly like the 'habits' un-fold was on its own ship day.
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
  // Nothing survived the filter (empty, or every entry was a dropped/unknown kind) — the
  // default order already contains both 'habits' and 'health', so there is nothing left to
  // append below. Checking this BEFORE the append matters: appending onto an empty array would
  // return `['health']` alone instead of falling back to the full default.
  if (clean.length === 0) return [...HOME_CARD_KINDS];
  const withHabits = clean.includes('habits')
    ? clean
    : clean.includes('plans')
      ? clean.flatMap((k): HomeCardKind[] => (k === 'plans' ? ['plans', 'habits'] : [k]))
      : clean;
  return withHabits.includes('health') ? withHabits : [...withHabits, 'health'];
}
