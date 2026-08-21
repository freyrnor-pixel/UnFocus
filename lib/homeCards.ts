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
 * **Three, not five, as of 2026-08-19** (maintainer: *"Make 'To-do' middle screen, and the
 * 'Home' can be the 'Me' for Health and notes. I think that makes things more tidy."*). To-do
 * and Shop are each their own tab, one swipe away, so a preview card for either was a second,
 * shorter copy of a whole tab — exactly the duplication the tab move was meant to end. 'plans'
 * and 'shopping' are therefore DROPPED kinds, in the same sense 'goals' has been since
 * 2026-07-29: the filter in `sanitizeHomeCardOrder` removes them from a stored order for free,
 * and neither loses a surface by going (unlike 'health', which had nowhere else to be).
 *
 * Habits stays, and is the one judgement call here: the maintainer named Health and Notes, and
 * habits is the third thing on this screen that is about the person rather than about a list —
 * and, like Health, it has no tab of its own to fall back to. Its card is still the way in to
 * the pushed app/habits.tsx.
 *
 * **'medicine' joined as a fourth on 2026-08-21** (maintainer, asked whether it should:
 * *"Yes."*). It was a full `Surface` rendered INSIDE HomeHealthCard's `Surface` — the
 * card-in-a-card the 2026-08-18 blueprint pass banned — which is what
 * `CONSISTENCY_AUDIT.md` §11 measured against the report *"Each thing is its own card, like
 * medicine and Health (which they currently are not)."* It is a peer now, not a child.
 *
 * ⚠️ **It is the one kind gated on a feature flag** (`settings.featureMedicine`). The gate is at
 * the RENDER site in app/(tabs)/index.tsx, never here: this module is dependency-free and cannot
 * read a setting, and more importantly a flag that hides a surface must not also edit the stored
 * order — turning medicine back on has to restore the card exactly where the user had dragged it.
 */
export const HOME_CARD_KINDS = ['habits', 'notes', 'health', 'medicine'] as const;

export type HomeCardKind = (typeof HOME_CARD_KINDS)[number];

/**
 * Kinds `sanitizeHomeCardOrder` puts back when a stored order is missing them — see its doc for
 * why each one, and for the consequence (they cannot be permanently hidden). 'notes' is
 * deliberately absent: its card previews a surface the card itself expands into, so losing it
 * loses a shortcut rather than a feature.
 */
const ALWAYS_PRESENT: readonly HomeCardKind[] = ['habits', 'health', 'medicine'] as const;

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
