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
 *   - ⚠️ **"Put it back" and "leave it where the user put it" are two questions, and the answer
 *     turns on whether the kind has another surface.** A card with no other home ('health' and
 *     'habits' while they were off the bottom nav) must be appended whenever a stored row is
 *     missing it, because filtering alone means "nobody sees the card that used to be a whole
 *     tab" — every stored row in existence predates any such change. A card that PREVIEWS a tab
 *     (all three of today's) must not be, or hiding it is undone by the next read. Both rules
 *     have been live in this file, and the second one arrived as a bug: the append survived the
 *     2026-08-22 pass with its membership inverted, so the ⋮ menu's "Hide" on Today and Shopping
 *     moved the card to the bottom of Home instead of retiring it. `LEGACY_KINDS` is how the
 *     repair now tells an old row from a deliberate one.
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
 * Kinds that were HOME CARDS in some earlier build and are not kinds any more. A stored order
 * naming one of these is a row written before the current card set existed — which is the only
 * thing that licenses the repair in `sanitizeHomeCardOrder` below.
 *
 * `'goals'` shipped for a day in 2026-07; `'habits'`, `'health'` and `'medicine'` were the Me
 * tab's cards from 2026-08-19 to 2026-08-22 and are surfaces of their own again (two tabs and a
 * card on one of them).
 */
const LEGACY_KINDS: readonly string[] = ['goals', 'habits', 'health', 'medicine'] as const;

/**
 * Kinds a LEGACY stored order gets back, because a row written before 2026-08-22 cannot name
 * them: both were dropped on 2026-08-19 and restored three days later, so every order written
 * in that window is missing them and filtering alone would leave Home as a single Notes card.
 *
 * ⚠️ **This is a repair for old rows, NOT a floor under the current ones** — the difference is
 * the whole reason `LEGACY_KINDS` exists, and getting it wrong was a live bug (2026-08-23).
 * The append used to run on EVERY order, inherited unchanged from when it held 'habits',
 * 'health' and 'medicine' — cards with no other surface in the app, where "it comes back" was
 * the deliberate trade. To-do and Shopping are whole TABS one swipe away, so nothing is lost by
 * hiding their preview card — and with an unconditional append, hiding one wrote an order the
 * very next read undid: the card reappeared at the BOTTOM of Home instead of in the Retired
 * shelf. Two of this tab's three cards had a ⋮ menu row that visibly did the wrong thing.
 */
const RESTORED_KINDS: readonly HomeCardKind[] = ['plans', 'shopping'] as const;

/**
 * Defensive parse for the persisted order: drop unknown and duplicate kinds, fall back to the
 * default order if nothing survives (a corrupt row, or one naming only kinds that are gone).
 *
 * **It also REPAIRS a legacy row**, appending `RESTORED_KINDS` — but only a row that names a
 * kind from an older card set (`LEGACY_KINDS`), which is the evidence that its author never had
 * the chance to name 'plans' or 'shopping'. Read both constants' docs before touching either;
 * the distinction is what keeps a repair from overruling a choice.
 *
 * **A row written by the current build is returned exactly as it stands.** Hiding a card from
 * its ⋮ menu therefore sticks: the card moves to the Retired shelf at the foot of Home
 * (components/HomeCardManager.tsx lists every kind in `labels` that is missing from `order`),
 * one tap from coming back. That is a real change from 2026-08-22, when the append ran on every
 * order and hiding Today or Shopping just moved the card to the BOTTOM of the screen.
 *
 * ⚠️ **The old always-append rule was RIGHT for the cards it was written for, and that is the
 * thing to understand before reinstating it.** From 2026-08-20 it held 'habits', 'health' and
 * 'medicine' — surfaces with no other home in the app at the time — where an unwanted card is
 * a smaller harm than a lost feature. Every kind here now previews a TAB (To-do, Shopping) or
 * a surface the card itself expands into (Notes), so hiding one costs nothing but the shortcut.
 * A kind that has nowhere else to live belongs in `RESTORED_KINDS` unconditionally again; a
 * kind that has a tab does not.
 *
 * Doing the repair on READ (rather than only in the `lib/db.ts` migration that empties the
 * column) covers a row that reaches this build afterwards: a restored backup, or a device that
 * was on the previous version.
 */
export function sanitizeHomeCardOrder(order: string[]): HomeCardKind[] {
  // Read BEFORE the filter, which is what throws the evidence away.
  const isLegacyRow = order.some((k) => LEGACY_KINDS.includes(k));
  const seen = new Set<string>();
  const clean = order.filter((k): k is HomeCardKind => {
    if (seen.has(k) || !(HOME_CARD_KINDS as readonly string[]).includes(k)) return false;
    seen.add(k);
    return true;
  });
  // Nothing survived the filter (empty, or every entry was a dropped/unknown kind) — fall back
  // to the full default rather than to whatever the repair below would have produced. This is
  // also the ordinary path for a row written before 2026-08-19 whose user had removed every
  // card, and for the emptied column the 2026-08-22 migration leaves behind.
  if (clean.length === 0) return [...HOME_CARD_KINDS];
  // A row that predates the current card set gets the kinds it could not have named. A row
  // written BY the current build is returned exactly as it stands, including a kind the user
  // has hidden — see RESTORED_KINDS for why those are two different questions.
  if (!isLegacyRow) return clean;
  const out = [...clean];
  for (const kind of RESTORED_KINDS) if (!out.includes(kind)) out.push(kind);
  return out;
}
