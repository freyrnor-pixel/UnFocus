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
 *   - **'health' must always end up in the list, and that is the lesson this file keeps.** It
 *     joined on 2026-08-20 when Health left the bottom nav — unlike 'goals' (2026-07-29), which
 *     had somewhere else to be, Health has no other surface at all once it is off the tab bar.
 *     The first cut argued "don't auto-add, it's reachable via Add a card" and shipped
 *     `sanitizeHomeCardOrder` withOUT the append; that did not hold, because EVERY stored row in
 *     existence predated the change, so "don't auto-add" meant "nobody sees the card that used
 *     to be a whole tab". Caught by the web preview walk, not by the unit tests — which had
 *     asserted the intended behaviour rather than checking it against the all-rows-predate-it
 *     fact. 'habits' carries the same append for the same reason.
 *   - **The 2026-08-19 "To-do middle, Home is Me" pass DROPPED 'plans' and 'shopping'**, which
 *     needs no handling at all: both are whole tabs, so filtering them out costs nobody a
 *     surface. That is the removal case, and it is the easy one — see the bullet above for the
 *     case that isn't. The 'habits' splice-after-'plans' rule that used to live here went with
 *     it; 'habits' is simply appended now, like 'health'.
 */

/**
 * The reorderable, removable Home cards, in default order.
 *
 * ⚠️ **Today, Notes, Shopping — as of 2026-08-22** (maintainer: *"The logic was sound before.
 * 'Home' had easy access to todays tasks, Notes, and shopping."*). Exactly those three, in that
 * order, and the order is the sentence.
 *
 * This REVERSES the 2026-08-19 pass, whose reasoning was that a preview card for a neighbouring
 * tab is a second, shorter copy of that tab. Overruled: seeing three surfaces at once without
 * swiping to any of them is what a hub is FOR, and it is the whole reason this screen exists.
 *
 * The surviving half of that argument is why `'habits'`, `'health'` and `'medicine'` left in the
 * same pass: Habits and Health are bottom-nav tabs again and Medicine is a card on the Health
 * tab, so each already has a home. A card AND a tab for one surface is the duplication worth
 * avoiding; a card that PREVIEWS a tab is not, which is the distinction the 2026-08-19 pass
 * collapsed.
 *
 * ⚠️ **No kind is behind a feature flag any more.** `'medicine'` was the one, and it left with
 * the card; `settings.featureMedicine` now gates the mount site inside
 * components/HealthSurface.tsx. Nothing here reads a setting — this module is dependency-free
 * and evaluated on every Home render.
 */
export const HOME_CARD_KINDS = ['plans', 'notes', 'shopping'] as const;

export type HomeCardKind = (typeof HOME_CARD_KINDS)[number];

/**
 * Kinds `sanitizeHomeCardOrder` puts back when a stored order is missing them — see its doc for
 * why each one, and for the consequence (they cannot be permanently hidden). 'notes' is
 * deliberately absent: its card previews a surface the card itself expands into, so losing it
 * loses a shortcut rather than a feature.
 *
 * ⚠️ **It is 'plans' and 'shopping' since 2026-08-22, i.e. the exact inverse of what it held.**
 * Both were DROPPED kinds from 2026-08-19 until this pass, so every stored row in existence
 * predates them being kinds again — which is this file's central lesson pointing the other way:
 * without the append, restoring them would reach nobody. (A `lib/db.ts` migration empties the
 * column in the same release, so most installs never exercise this path; the append is what
 * covers a row written by an older build, a restored backup, or a paired device.)
 */
const ALWAYS_PRESENT: readonly HomeCardKind[] = ['plans', 'shopping'] as const;

/**
 * Defensive parse for the persisted order: drop unknown and duplicate kinds, fall back to the
 * default order if nothing survives (a corrupt or legacy row).
 *
 * **It also APPENDS 'habits', 'health' and 'medicine' whenever any is missing.** All three are
 * cards a user has no other way back to — Habits' card is the only entry to the pushed habits
 * screen, Health has no screen of its own at all, and Medicine's only other home was inside the
 * Health card it left on 2026-08-21 — and a row written by an older build, restored from a
 * backup, or synced from a paired device can be missing any of them. Filtering alone would leave
 * such a card simply absent, with nothing on screen suggesting it still exists.
 *
 * Medicine's case is the strongest of the three, and it is the one this file's central lesson was
 * written about: EVERY stored row in existence predates it being a kind at all, so without the
 * append the decision to promote it would have reached nobody.
 *
 * ⚠️ **The consequence is that a user cannot permanently remove any of the three from Home**:
 * hiding one lasts until the next read. That is the deliberate trade (a lost surface is worse than an
 * unwanted card), and it is worth knowing before debugging a card that "comes back". 'notes' has
 * no append and can be removed for good — the Notes card is a preview of a surface the Home card
 * itself expands into, so losing it loses a shortcut, not a feature.
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
  // default order already contains every ALWAYS_PRESENT kind, so there is nothing left to
  // append below. Checking this BEFORE the append matters: appending onto an empty array would return
  // `['health']` alone instead of falling back to the full default. It is also the ordinary
  // path for a row written before the 2026-08-19 pass whose user had removed all three
  // survivors — 'plans' and 'shopping' alone now filter down to nothing.
  if (clean.length === 0) return [...HOME_CARD_KINDS];
  // 'habits' used to be spliced in after 'plans' (it had been folded into that card for a few
  // hours on 2026-08-20). With 'plans' no longer a kind at all there is no position left to
  // restore it NEXT TO, so it is appended like 'health' — the un-fold window is years of
  // installs behind us, and the two arms had already converged on "put it back somewhere".
  //
  // Medicine appends LAST of the three, which is also where it sits in the default order: it
  // is the one card here that a user can genuinely not have (featureMedicine), so pushing it
  // to the end keeps the three unconditional cards in a stable position for everybody.
  const out = [...clean];
  for (const kind of ALWAYS_PRESENT) if (!out.includes(kind)) out.push(kind);
  return out;
}
