/**
 * index.tsx — "Meg", the app's personal tab.
 *
 * Mounts via ScreenScaffold (Decision 001): the scaffold owns the background, particles, header
 * chrome (Settings gear + Focus eye) and BottomNav; this screen only supplies content.
 *
 * **It was "I dag", the daily landing hub, until 2026-08-19.** Maintainer: *"Make 'To-do'
 * middle screen, and the 'Home' can be the 'Me' for Health and notes. I think that makes things
 * more tidy."* Two consequences, and the second is the bigger one:
 *   - **It is an END tab now**, not the centre — To-do (app/(tabs)/plans.tsx) sits between this
 *     and Shop. The route is still `/` and the SiteKey is still `'home'`; only the label, the
 *     icon and the position moved (lib/siteNav.ts).
 *   - **It stopped previewing the two tabs beside it.** The To-do preview card
 *     (components/PlanTaskCard.tsx, read-only, with the day log, the quick-add, the deleted-task
 *     drawer and the timeline layouts) and the Shopping preview card
 *     (with its four-week pager, spend pace, flight animation and quick-add) are BOTH gone from
 *     this file, along with every handler, memo and store selector that fed them — roughly 390
 *     lines. ⚠️ `components/HomeShoppingCard.tsx` was DELETED with them: this screen was its only
 *     mount site, and the repo's rule is that a retired surface goes rather than lingering
 *     unimported where a later session can quietly rewire it. `PlanTaskCard` survives — the To-do
 *     tab's timeline layout still mounts it. Neither surface lost anything: each is a whole
 *     tab one swipe away, and a shorter second copy of a neighbouring tab is exactly the
 *     duplication that pass set out to remove.
 *
 * **Render order, and which parts of it the user can move**:
 *   1. Greeting + date — fixed (its own `header` block), and still a date: this is the screen
 *      you land on from a cold launch by default, and "which day is it" is orienting rather than
 *      a to-do list.
 *   2. Energy STRIP (components/EnergyMeter.tsx) — fixed, and absent entirely when
 *      `settings.energySystemEnabled` is off. Not a card: one thin line, no surface. It stays
 *      here rather than following To-do to its tab — Energy is a planning budget for the day,
 *      which is a fact about the person, and the Health tab's no-scoreboard contract is what
 *      keeps it off there too (see AGENTS.md).
 *   3. Shared card (components/HomeSharedCard.tsx) — fixed, and only present when something has
 *      actually arrived (`hasIncomingShared`). Above the cards on purpose: it is transient,
 *      time-sensitive and from another person, so below them it would be missed. Interruptive
 *      content goes high or it does not work. Don't demote it.
 *   4–6. Habits / Notes / Health — the ONLY reorderable, retirable cards, driven by
 *      `settings.homeCardOrder` through components/HomeCardManager.tsx (long-press to drag, the
 *      card's own ⋮ → Hide to retire it, the Retired shelf at the foot to bring it back). There
 *      is no floor of one card any more, and no edit mode — see the 2026-08-20 note below.
 *      ⚠️ Habits and Health are re-appended on read if a stored order does not name them — see
 *      lib/homeCards.ts, which also explains why 'notes' deliberately is not.
 *   7. The cumulative "you've done N things" line — fixed to the bottom, and the last child of
 *      `content` so it cannot be reordered into the stack. It counts tasks, which now live one
 *      tab over; it stays because it is a lifetime figure about the user, not a view of that
 *      tab's list.
 * Items 1–3 and 7 are fixed *structurally*: they are siblings of `HomeCardManager`, not entries
 * in `HOME_CARD_KINDS`, so no code path can drag or delete them.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/EnergyMeter (the fixed Energy strip, gated
 *             on settings.energySystemEnabled), components/HomeHabitsCard, components/HomeNotesCard,
 *             components/HomeHealthCard (each self-contained — they read their own stores and
 *             own their own useCardExpand), components/HomeSharedCard (gated on
 *             settings.featureSharing + SHARING_VISIBLE), components/HomeCardManager,
 *             components/CardMenuSheet (the CardMenu type),
 *             components/DebugNoteAnchor, components/TourTarget, components/PressableScale,
 *             constants/theme, lib/i18n, lib/useAppTheme, lib/haptics, lib/homeCards,
 *             lib/sharingVisibility,
 *             store/useSettingsStore, store/useSharedStore
 *   Used by → Expo Router route "/" — one of 3 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads useSharedStore (incoming shared tasks/shopping, for the self-hide check) and
 *             a handful of useSettingsStore fields; writes settings.homeCardOrder and nothing
 *             else. The three preview cards own all their own reads and writes — nothing is
 *             threaded down as props any more.
 *
 * Edit notes:
 *   - Store hydration happens once at startup in app/_layout.tsx — no per-screen initDb/load.
 *   - **⚠️ There is no ⓘ hint on this screen, or on any other (2026-08-20).** Maintainer:
 *     *"The top text box can be removed"*, with the standing rule that *"tips/explanation goes
 *     in the card for empty states"*. components/HintCard.tsx and lib/useFirstVisitHint.ts are
 *     DELETED app-wide, not unmounted. This screen's banner was the awkward one, because its
 *     body held the ONLY copy of the task-notification and weekly-reminder opt-ins — a panel
 *     whose contents are settings, reached by a deliberate ⓘ tap, which is the same complaint
 *     that moved Shopping's cadence pickers out on 2026-08-13. Both switches already exist in
 *     app/settings.tsx's `NOTIF_SWITCHES`, and the Settings copies are strictly better: they
 *     ask for the OS permission through `applyAndSync`, which the two hand-rolled ones here
 *     only half did. So this deletes rather than re-homes, and with it goes the last reason
 *     this file imported `useTaskStore`, lib/notifications and lib/reminders at all.
 *   - **Every card here is self-contained**, which is what made the To-do/Shopping removal a
 *     deletion rather than a refactor: HomeHabitsCard/HomeNotesCard/HomeHealthCard read their
 *     own stores and mount their own lib/useCardExpand. PlanTaskCard was the exception — a
 *     "dumb", prop-driven card — which is why ~390 lines of handlers and memos lived here to
 *     feed it. Keep new cards on the self-contained side.
 *   - **The guided tour's Home step spotlights the Habits card** (`tour.home.me`). It used to
 *     ring the To-do preview; see the comment at that case, and lib/tourSteps.ts.
 *   - **⚠️ No greeting and no edit mode (2026-08-20, UI-consistency pass).** Maintainer:
 *     *"The top text box can be removed, same with the 'Good day' in home"*, *"remove the 'Edit
 *     cards' button as well, and when a card is hidden it just goes to a totally collapsed state
 *     at the bottom in a section called 'Retired'"*. Three things went, and the third is the one
 *     worth knowing: the greeting + date line (with `t.greeting.*`), the `cardsEditMode` state
 *     and both its buttons, and the **floor of one card** — hiding the last card was blocked
 *     because it left "a screen with a greeting and nothing else, and no visible way back",
 *     and BOTH halves of that reason expired in this same pass. `t.home.cardMenu.hideLastHint`
 *     is deleted rather than left unused, so the guard cannot be quietly restored against a
 *     reason that is gone.
 *     What survives untouched: `renderHomeCard(kind)` is still the per-kind render function
 *     passed down, `sanitizeHomeCardOrder` still defends against a corrupt/legacy settings row,
 *     and holding any card still drag-reorders it — the drag was NEVER gated on the mode
 *     (components/HomeCardManager.tsx documents that), which is why the mode could go without
 *     taking a capability with it.
 *   - **The flight animation is gone from this screen** (2026-08-19) — only the shopping preview
 *     card ever started one, so `flights`/`FlightOverlay`/`handleScreenScroll` went with it. The
 *     pattern still lives on app/(tabs)/shopping.tsx; see ANIMATION_GUIDELINES.md.
 *   - All visible strings via useT().
 *   - **Debug notes (2026-07-13)**: each top-level section is wrapped in DebugNoteAnchor with a
 *     hand-picked stable id (`home.habitsPreview`/`home.notesPreview`/`home.healthPreview`/
 *     `home.sharedPreview`) — a no-op unless Debug mode is on (settings.debugModeEnabled).
 *     ⚠️ `home.plansPreview`, `home.shoppingPreview` and — since 2026-08-20 — `home.greeting`
 *     are RETIRED ids; any note a tester left on them is orphaned rather than shown somewhere
 *     else.
 */
import React, { useCallback, useMemo } from 'react';

import { StyleSheet, Text, View } from 'react-native';
import ScreenScaffold from '@/components/ScreenScaffold';
import EnergyMeter from '@/components/EnergyMeter';
import HomeNotesCard from '@/components/HomeNotesCard';
import HomeSharedCard from '@/components/HomeSharedCard';
import HomeHabitsCard from '@/components/HomeHabitsCard';
import HomeHealthCard from '@/components/HomeHealthCard';
import HomeCardManager from '@/components/HomeCardManager';
import type { CardMenu } from '@/components/CardMenuSheet';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';

import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { Fonts, FontSize, SCREEN_GAP, Spacing } from '@/constants/theme';

import { SharedShoppingItem, SharedTask, useSharedStore } from '@/store/useSharedStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { sanitizeHomeCardOrder, type HomeCardKind } from '@/lib/homeCards';

// Home preview card management (hold-to-manage, components/HomeCardManager.tsx). The kinds
// and the persisted-order parse moved to lib/homeCards.ts on 2026-08-20 so the 'habits' →
// 'plans' fold-in could be unit-tested; HomeSharedCard is a separate, automatic/data-driven
// inbox, not a discretionary card, so it stays outside that set either way.
export default function HomeScreen() {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);


  // Mirrors HomeSharedCard's own self-hide check exactly — needed here too so this
  // screen doesn't mount an empty `section` wrapper (marginTop: Spacing.xl) around a
  // card that renders nothing, which was doubling the gap to the next card below it
  // whenever nothing was incoming (the common case).
  const sharedTasks = useSharedStore((s) => s.tasks);
  const sharedShoppingItems = useSharedStore((s) => s.shoppingItems);
  // Sharing is the one opt-in left that affects Home (Settings → Advanced → Features),
  // off on a fresh install — it hides the incoming-shares card below. Data is never
  // touched: turning it back on brings the card straight back. Declared up here rather
  // than with the other settings selectors below because hasIncomingShared needs it.
  // Scan & receipts used to gate the spend-vs-budget pace line the same way, but is now
  // always on (2026-07-25 defaults revision) — see the `pace` prop further down.
  // Sharing is hidden wholesale while the single-user basics are reworked (2026-08-05) —
  // see lib/sharingVisibility.ts. The setting is still read so nothing else changes shape.
  const featureSharing = useSettingsStore((s) => s.featureSharing) && SHARING_VISIBLE;
  // Energy is a real toggle again (2026-07-31) — gates the meter below.
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);

  const hasIncomingShared =
    featureSharing &&
    (sharedTasks.some((x: SharedTask) => x.direction === 'in' && !x.done) ||
      sharedShoppingItems.some((i: SharedShoppingItem) => i.direction === 'in' && !i.done));

  // Field selectors, NOT a whole-store subscription: `const settings = useSettingsStore()`
  // subscribed Home to every settings field, so any unrelated settings change (dark mode,
  // focus toggle, any update()) repainted the whole screen and re-ran the derived work
  // below. These select only the fields Home actually reads.
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const setupComplete = useSettingsStore((s) => s.setupComplete);
  const homeCardOrderRaw = useSettingsStore((s) => s.homeCardOrder);
  const updateSettings = useSettingsStore((s) => s.update);
  // All-time counter, maintained by useTaskStore (toggle/completeDirect/remove/
  // clearAll) so it survives pruneOldData() pruning old completed tasks — see
  // store/useTaskStore.ts's "All-time completed-task counter" edit note.
  const completedCount = useSettingsStore((s) => s.lifetimeCompletedTasks);

  const homeCardOrder = useMemo(() => sanitizeHomeCardOrder(homeCardOrderRaw), [homeCardOrderRaw]);
  const homeCardLabels = useMemo(
    () => ({
      notes: t.home.manageCards.kinds.notes,
      habits: t.home.manageCards.kinds.habits,
      health: t.home.manageCards.kinds.health,
    }),
    [t]
  );

  // ⚠️ **No greeting and no edit mode here since 2026-08-20** (UI-consistency pass: *"remove
  // the 'Good day' in home"*, *"remove the 'Edit cards' button as well"*). Both are DELETED,
  // not hidden — the greeting helper, the date line and the `cardsEditMode` state that used to
  // sit in that header row are gone, and the screen opens on its first card. Hiding a card is
  // the ⋮ menu's "Hide" row (below) and un-hiding it is the Retired drawer at the foot of
  // components/HomeCardManager.tsx; neither needs a mode. Drag-to-reorder never needed one
  // either — lib/useDragReorder's long-press has always been live regardless of `editMode`,
  // which is exactly why the mode could go without taking a capability with it.

  // The per-card "⋮" menu (components/CardMenuSheet.tsx, workstream A / the design project's
  // one un-filled component gap). Built HERE and passed down, never built by the card: every
  // row it carries writes `settings.homeCardOrder` or flips `cardsEditMode`, and a preview
  // card can reach neither. See CardMenuSheet's "The menu is built by whoever owns the state
  // it changes" note before moving this into a card.
  //
  // Two rows for now, which is the honest size of what a Home card can currently be told to
  // do — hide, and arrange. Deliberately NOT a "delete": a hidden card keeps its screen, its
  // rows and its reminders, and calling that delete would be the one line in this sheet that
  // lies about what it does. Layout ("How lists look") stays on its own header icon rather
  // than moving in here: it is a *surface* setting shared with the To-do tab
  // (lib/useSurfaceLayout.ts), not a Home-card setting, so folding it in would put one
  // control in two places with different scopes.
  const buildCardMenu = useCallback(
    (kind: HomeCardKind): CardMenu => {
      // **The last card may now be hidden (2026-08-20), and that is a real reversal.** It was
      // blocked because hiding everything left "a screen with a greeting and nothing else, and
      // no visible way back — the add-picker lives inside edit mode". Both halves of that
      // expired in the same pass: there is no greeting, and the Retired drawer is always on
      // screen with every hidden card one tap from returning. A guard whose reason is gone is
      // a control that refuses for no stated cause, which is worse than the state it prevents.
      return {
        options: [
          {
            key: 'hide',
            label: t.home.cardMenu.hide,
            icon: 'eye-off-outline',
            hint: t.home.cardMenu.hideHint,
            onPress: () => updateSettings({ homeCardOrder: homeCardOrder.filter((k) => k !== kind) }),
          },
        ],
        // No `onEditLayout`: the mode it handed off to does not exist any more, and the drag
        // it described is always available on a long-press. `arrangeHint` still says so.
      };
    },
    [homeCardOrder, updateSettings, t]
  );

  // Renders one managed Home card by kind — HomeCardManager owns the reorder/delete/add
  // chrome around this, Home still owns the actual card JSX/props (unchanged from before
  // the hold-to-manage refactor, just split into a per-kind function so it can be driven
  // by the user's homeCardOrder instead of a fixed block).
  function renderHomeCard(kind: string) {
    switch (kind as HomeCardKind) {
      case 'notes':
        return (
          <DebugNoteAnchor id="home.notesPreview" label="Home — Notes preview" style={styles.section}>
            <HomeNotesCard cardMenu={buildCardMenu('notes')} />
          </DebugNoteAnchor>
        );
      case 'habits':
        return (
          // The guided tour's Home step spotlights this card (lib/tourSteps.ts, `tour.home.me`).
          // It moved here on 2026-08-19 with the target it used to sit on: the To-do preview
          // card, which left this screen when To-do became the middle tab. Habits is the first
          // card in the default order and the one thing here that is unambiguously "you", which
          // is what this tab is now for. A user who has dragged it elsewhere just gets the
          // spotlight wherever they put it — the tour measures the target, not a position.
          <TourTarget id="tour.home.me">
            <DebugNoteAnchor id="home.habitsPreview" label="Home — Habits preview" style={styles.section}>
              <HomeHabitsCard cardMenu={buildCardMenu('habits')} />
            </DebugNoteAnchor>
          </TourTarget>
        );
      case 'health':
        return (
          <DebugNoteAnchor id="home.healthPreview" label="Home — Health preview" style={styles.section}>
            <HomeHealthCard cardMenu={buildCardMenu('health')} />
          </DebugNoteAnchor>
        );
      default:
        return null;
    }
  }

  // All hooks above must run on every render (Rules of Hooks), so this loading
  // guard sits below them rather than up among the useMemo block.
  if (!settingsLoaded || !setupComplete) {
    return <View style={[styles.blank, { backgroundColor: theme.bg }]} />;
  }

  return (
    <>
      <ScreenScaffold
        title={t.nav.home}
        tier="site"
        isHome
        bottomNav={false}
        pagerFloatingNav
        ownBackground={false}
      >
        <View style={styles.content}>
          {/* ⚠️ **The ⓘ hint banner is GONE (2026-08-20)** — see the header. Its BODY was two
              notification switches (task reminders, the weekly nudge), and deleting them loses
              nothing: both are in app/settings.tsx's `NOTIF_SWITCHES`, which is the inventory,
              and the Settings copies additionally ask for the OS permission through
              `applyAndSync` — which these two hand-rolled ones only half did. */}
          {/* Energy STRIP (2026-07-31, addendum task B.2) — no longer a card: one thin line of
              pips + `n / n` + an edit glyph, with its permanent explainer under it. It is FIXED
              here: outside HOME_CARD_KINDS/HomeCardManager, so it can be neither dragged nor
              removed with the × — the only way to make it go away is turning Energy off in
              Settings → Advanced → Features, which is what `energySystemEnabled` gates (on by
              default; the meter was unconditional 2026-07-26→2026-07-31). It uses `energyStrip`,
              not `section`: a full Spacing.xl band above a one-line strip re-created the card's
              worth of vertical space the strip exists to give back. Its explainer lives INSIDE
              the strip as a permanent line (2026-07-27) — it used to be a separate StarterCard
              rendered here, which sat directly above the Plans card and so read as belonging to
              the to-do card, making its disappear-on-first-use behaviour look like a bug in the
              wrong place. */}
          {energySystemEnabled && (
            <View style={styles.energyStrip}>
              <EnergyMeter />
            </View>
          )}

          {/* Shared preview — HomeSharedCard (incoming shared tasks + shopping). Self-hides
              when nothing is incoming — gated here too (not just inside HomeSharedCard) so no
              empty `section`-margin wrapper is mounted in that case (see hasIncomingShared
              above). Hidden in Focus mode (an input/triage surface). Sits outside the
              hold-to-manage stack below — it's automatic/data-driven, not a discretionary
              card (Decision: home preview card management, 2026-07-19). */}
          {hasIncomingShared && (
            <DebugNoteAnchor id="home.sharedPreview" label="Home — Shared preview" style={styles.section}>
              <HomeSharedCard />
            </DebugNoteAnchor>
          )}

          {/* Notes/Plans/Shopping previews — user-manageable (hold-to-reorder/remove/add,
              components/HomeCardManager.tsx), order+visibility from settings.homeCardOrder. */}
          <HomeCardManager
            order={homeCardOrder}
            labels={homeCardLabels}
            onReorder={(next) => updateSettings({ homeCardOrder: next })}
            onAdd={(kind) => updateSettings({ homeCardOrder: [...homeCardOrder, kind] })}
            renderCard={renderHomeCard}
          />

          {/* Gentle points */}
          {completedCount > 0 && (
            <View style={styles.section}>
              <Text style={[styles.pointsText, { color: theme.textMuted }]}>
                {t.smallThingsCount(completedCount)}
              </Text>
            </View>
          )}
        </View>
      </ScreenScaffold>
    </>
  );
}

const baseStyles = StyleSheet.create({
  blank: { flex: 1 },
  // The screen owns the vertical rhythm (2026-08-08). `gap` here, and NO vertical margin on
  // any card in the stack — see SCREEN_GAP's doc in constants/theme.ts for the five different
  // gaps this replaced. A child that is always mounted but sometimes zero-height (a closed
  // Collapsible) must be grouped or conditionally rendered, or it books a gap slot for nothing.
  // No vertical padding (2026-08-19): components/ScreenScaffold.tsx clips this content
  // flush to the header's glass and the nav bar's, and a margin here is the blank strip
  // that clip exists to delete. Horizontal padding stays — the side gutters are backdrop.
  content: { paddingHorizontal: Spacing.md, gap: SCREEN_GAP },
  // A plain grouping wrapper now — the screen's content container owns the gap between
  // stacked cards (SCREEN_GAP, constants/theme.ts). Was `marginTop: Spacing.xl`.
  section: {},
  // The Energy strip is chrome, not a card, so it gets a card-gap's worth of space BELOW it
  // (the next section's own Spacing.xl) but only a hair above. It used to be leaning on the
  // greeting's marginBottom for the separation above it; with the greeting gone (2026-08-20)
  // what is above it is the scaffold's own top edge, and Spacing.xs is still the right hair.
  energyStrip: { marginTop: Spacing.xs },
  pointsText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
