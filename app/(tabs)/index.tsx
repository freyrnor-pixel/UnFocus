/**
 * index.tsx — Hjem, the middle tab: today, and nothing else.
 *
 * **V2 re-order (2026-10-11, maintainer-approved mockup).** Each card lives in exactly ONE place.
 * Hjem draws:
 *   1. Energy (components/EnergyMeter.tsx) — fixed, absent when `settings.energySystemEnabled` is
 *      off. Not a registry card, so it can be neither moved nor hidden.
 *   2. Shared card (components/HomeSharedCard.tsx) — only when something has arrived.
 *   3. I dag (`homeToday`, components/PlanTaskCard.tsx) and Notater (`homeNotes`) — registry
 *      cards, ordered/hidden through `settings.cardOrder` + `settings.hiddenCards`.
 *   4. The lifetime "N small things" line.
 *
 * ⚠️ **The Handleliste preview is GONE (2026-10-11)**, with `components/HomeShoppingCard.tsx` and
 * the flight/pager/pace plumbing that only it used. Shopping is done on the Handle tab, whose list
 * card's ⤢ is shopping mode. I dag is no longer on the Gjøremål tab either — it lives here, and
 * its full-screen pane is To-do's `todoToday` body (registry: `nested: 'homeToday'`).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/EnergyMeter (the fixed Energy strip, gated
 *             on settings.energySystemEnabled), components/HabitsSurface.tsx, components/HomeNotesCard,
 *             components/HealthSurface.tsx, components/MedicineSurface.tsx (each self-contained — they read their own stores and
 *             own their own useCardExpand), components/HomeSharedCard (gated on
 *             settings.featureSharing + SHARING_VISIBLE), components/ManageCardsSheet,
 *             components/DebugNoteAnchor, components/TourTarget, components/PressableScale,
 *             constants/theme, lib/i18n, lib/useAppTheme, lib/haptics, lib/useCardOrder,
 *             lib/sharingVisibility,
 *             store/useSettingsStore, store/useSharedStore
 *   Used by → Expo Router route "/" — one of 3 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads useSharedStore (incoming shared tasks/shopping, for the self-hide check) and
 *             a handful of useSettingsStore fields; writes nothing
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
 *     ⚠️ **The rest of that machinery is gone too as of 2026-09-01** — see the next note.
 *   - ⚠️ **Home has no per-card ⋮, no Retired shelf and no order column of its own
 *     (2026-09-01).** Maintainer, against the shipped app: *"One button per screen for
 *     reordering and/or hiding cards instead of the three dots was disregarded, and now it's
 *     not how we agreed to do it."* So this screen joined the other four:
 *     `settings.hiddenCards` + `settings.cardOrder` through one header control
 *     (components/ManageCardsSheet.tsx). Deleted with it: `components/HomeCardManager.tsx`,
 *     `components/CardMenuSheet.tsx` and its `CardMenuButton`, the `cardMenu` prop on all three
 *     cards, `lib/homeCards.ts`, the `homeRetired` registry entry, and `t.home.cardMenu.*`.
 *     `settings.homeCardOrder` survives as an INERT column (this repo never drops one) — see
 *     store/useSettingsStore.ts's "Inert columns" note.
 *       **`RESTORED_KINDS`' forced-restore rule goes with it, and that is a real behaviour
 *     change worth stating.** It existed because a card with no other surface in the app must
 *     come back if a stored row does not name it. Every Home card previews a TAB, and the sheet
 *     lists every card present-or-absent, so "nobody sees the card that used to be a whole tab"
 *     cannot happen through this route any more — the naming IS the restore path.
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
import React, { useCallback, useMemo, useState } from 'react';

import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import EnergyMeter from '@/components/EnergyMeter';
import { countRender } from '@/lib/perfTrace';
import PlanTaskCard from '@/components/PlanTaskCard';
import HomeNotesCard from '@/components/HomeNotesCard';
import HomeSharedCard from '@/components/HomeSharedCard';
import ManageCardsSheet from '@/components/ManageCardsSheet';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';

import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { Fonts, FontSize, SCREEN_GAP, Spacing } from '@/constants/theme';
import { todayStr } from '@/lib/date';
import { useSurfaceLayout } from '@/lib/useSurfaceLayout';
import { useCardState } from '@/lib/useCardState';
import { useDayLog } from '@/lib/useDayLog';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { DayEntry } from '@/lib/dayLog';

import { Task, Recurring, useTaskStore } from '@/store/useTaskStore';
import { SharedShoppingItem, SharedTask, useSharedStore } from '@/store/useSharedStore';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import type { CardKey } from '@/lib/cardRegistry';
import { useOrderedCards } from '@/lib/useCardOrder';

// HomeSharedCard is a separate, automatic/data-driven inbox rather than a discretionary card,
// which is why it is not in lib/cardRegistry.ts and cannot be hidden or moved.
export default function HomeScreen() {
  // ⚠️ **Temporary instrument (2026-09-10), paired with the one in components/EnergyMeter.tsx.**
  // Two counters answer a question one cannot: if Home and the Energy card tick at the SAME
  // rate, something is re-rendering the whole screen and the card is only where it shows;
  // if the card runs far ahead of Home, the loop is inside the card. Remove both together.
  countRender('Home');
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const today = todayStr();

  const tasks = useTaskStore((s) => s.tasks);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const toggleTask = useTaskStore((s) => s.toggle);
  const addTask = useTaskStore((s) => s.add);
  const removeTask = useTaskStore((s) => s.remove);
  const restoreTask = useTaskStore((s) => s.restore);
  const deletedTasks = useTaskStore((s) => s.deletedTasks);


  // Home's to-do card resolves its own layout + size, independently of the To-do tab — see the
  // `spec` prop's comment at the PlanTaskCard mount below.
  const todoSpec = useSurfaceLayout('homeTodo');
  const [todoState, setTodoState] = useCardState('homeTodo');
  const planTimelineHorizontal = useSettingsStore((s) => s.planTimelineHorizontal);


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
  // All-time counter, maintained by useTaskStore (toggle/completeDirect/remove/
  // clearAll) so it survives pruneOldData() pruning old completed tasks — see
  // store/useTaskStore.ts's "All-time completed-task counter" edit note.
  const completedCount = useSettingsStore((s) => s.lifetimeCompletedTasks);

  // The same hook the other four screens read, over the same column — see the header note on
  // why Home stopped having its own.
  const cardOrder = useOrderedCards('home');
  const [manageCardsOpen, setManageCardsOpen] = useState(false);

  // ⚠️ **No greeting and no edit mode here since 2026-08-20** (UI-consistency pass: *"remove
  // the 'Good day' in home"*, *"remove the 'Edit cards' button as well"*). Both are DELETED,
  // not hidden — the greeting helper, the date line and the `cardsEditMode` state that used to
  // sit in that header row are gone, and the screen opens on its first card. Hiding and moving
  // a card are both the "Manage cards" header control since 2026-09-01; neither needs a mode.

  // `tasks` is NOT an unnecessary dependency, whatever eslint's exhaustive-deps says here:
  // `tasksForDate` is a Zustand store method whose identity never changes and which reads
  // `get().tasks` internally. Drop `tasks` and this memo never recomputes — Home would keep
  // rendering the task list it saw on mount. Verified by the store: useTaskStore.ts's
  // `tasksForDate(date)` is `get().tasks.filter(...)`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todayTasks = useMemo(() => tasksForDate(today), [tasksForDate, today, tasks]);

  // The day log (2026-08-02) — the same hook and the same 60s "now" tick the To-do tab's
  // timeline uses, so Home's preview and the full day-view can never disagree about where
  // the boundary is. Returns undefined when settings.featureDayLog is off, which is what
  // PlanTaskCard's dayLog prop gates itself on below.
  const nowMinutes = useNowMinutes();
  const dayLog = useDayLog(today, nowMinutes);
  const removeMoment = useMomentsStore((s) => s.remove);
  const addMoment = useMomentsStore((s) => s.add);
  // Only a task has an in-app editor to open. Doses and health entries live on the Health
  const handlePressLogEntry = useCallback(
    (entry: DayEntry) => {
      if (entry.kind !== 'task' || !entry.sourceId) return;
      // `/plans` is a pager tab now (2026-08-20) — `navigate`, not `push`, or this stacks a
      // second copy of the tab on top of itself. No `tab` param any more either: TodoSurface
      // has no tabs left to select, `expandTaskId` alone reaches the right card.
      router.navigate({ pathname: '/plans', params: { expandTaskId: entry.sourceId } });
    },
    [router]
  );


  const handleToggleTask = useCallback((task: Task) => toggleTask(task.id), [toggleTask]);
  // Delete is a soft delete (store/useTaskStore's tombstone) and the day-view renders a
  // "Recently deleted" restore drawer right below, so no confirmation dialog here — the undo
  // IS the safety net (2026-07-27, user report: "no apparent way to delete and recover
  // deleted tasks").
  const handleDeleteTask = useCallback((task: Task) => removeTask(task.id), [removeTask]);
  const handleRestoreTask = useCallback((task: Task) => restoreTask(task.id), [restoreTask]);
  // Empty-day suggestion — a real task, not a placeholder: an undated (Whenever) task dated
  // today, exactly the shape the quick-add AddRow produces, so nothing about it is special
  // once it exists.
  const handleAddExampleTask = useCallback(() => {
    addTask({
      title: t.starters.plans.exampleTitle,
      date: today,
      taskType: 'start-at',
      done: false,
      recurring: 'none',
      recurringDays: [],
      sortOrder: 0,
      hasStartDate: false,
    });
  }, [addTask, today, t]);
  // Inline quick-add from the Home Plans preview — mirrors app/plans.tsx's Whenever
  // AddRow: an undated (hasStartDate:false) task dated today, so it shows in Today, the day's
  // list, and the All tab's Whenever without any extra sync. Lets a task be created without
  // leaving Home (was: force-navigate to /plans). `extra` carries whichever of PlanTaskCard's
  // quick-add essential settings (time/recurring/energy) the user touched — monthDay defaults
  // to today's day-of-month so a 'monthly' pick from the chip is a valid occurrence out of the
  // gate (mirrors TaskCard's own defaulting for recurringDays/monthDay).
  // Shared with handleAddTaskAndEdit below — building the TaskInput is the only part that's
  // common; each caller decides what to do with the created Task afterward.
  const buildQuickAddTaskInput = useCallback(
    (title: string, extra: { time?: string; recurring: Recurring; recurringDays: number[] }) => ({
      title,
      date: today,
      time: extra.time,
      taskType: 'start-at' as const,
      done: false,
      recurring: extra.recurring,
      recurringDays: extra.recurringDays,
      weekInterval: 1,
      monthlyMode: 'day' as const,
      monthDay: new Date().getDate(),
      monthOrdinal: 'first' as const,
      monthWeekday: 0,
      sortOrder: 0,
      hasStartDate: false,
      assignee: '',
    }),
    [today]
  );

  const handleAddTask = useCallback(
    (title: string, extra: { time?: string; recurring: Recurring; recurringDays: number[] }) => {
      addTask(buildQuickAddTaskInput(title, extra));
    },
    [addTask, buildQuickAddTaskInput]
  );

  // "…" quick-add (2026-08-01): same create as handleAddTask, but also opens the new task's
  // full editor (TaskCard, on the To-do tab) pre-filled, via the expandTaskId param
  // TodoSurface already wires for exactly this (built for a note's "Add to plans" flow,
  // previously uncalled). `expandTaskId`'s autoExpand lives on the Whenever section's
  // TaskCard — an undated (hasStartDate:false) task like this always shows there.
  // `/plans` is a pager tab now (2026-08-20) — `navigate`, not `push`, or this stacks a
  // second copy of the tab on top of itself.
  // An EMPTY title is a real case (2026-08-05): "More options" is pressable the moment the
  // quick-add line is focused, so it must always lead somewhere rather than silently doing
  // nothing. With nothing typed there is no task worth creating — an untitled row would be
  // junk the user then has to clean up — so it just opens the To-do tab, which is the
  // "more options" the press was asking for.
  const handleAddTaskAndEdit = useCallback(
    (title: string, extra: { time?: string; recurring: Recurring; recurringDays: number[] }) => {
      if (!title) {
        router.navigate('/plans');
        return;
      }
      const task = addTask(buildQuickAddTaskInput(title, extra));
      router.navigate({ pathname: '/plans', params: { expandTaskId: task.id } });
    },
    [addTask, buildQuickAddTaskInput, router]
  );


  const notesNode = useMemo(
    () => (
      <DebugNoteAnchor id="home.notesPreview" label="Home — Notes preview" style={styles.section}>
        <HomeNotesCard />
      </DebugNoteAnchor>
    ),
    // `styles.section` is a module-level StyleSheet and therefore constant; it is listed only
    // because the exhaustive-deps rule cannot prove that, and an ignore comment would be a
    // worse trade than one stable reference.
    [styles.section]
  );

  const todayNode = useMemo(
    () => (
      <TourTarget id="tour.home.today">
        <DebugNoteAnchor id="home.plansPreview" label="Home — Plans preview" style={styles.section}>
                <PlanTaskCard
                  tasks={todayTasks}
                  allTasks={tasks}
                  readOnly
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onAddTaskAndEdit={handleAddTaskAndEdit}
                  onDeleteTask={handleDeleteTask}
                  deletedTasks={deletedTasks}
                  onRestoreTask={handleRestoreTask}
                  onAddExample={handleAddExampleTask}
                  horizontal={planTimelineHorizontal}
                  // Home's to-do card is its OWN layout surface, separate from the To-do tab
                  // (2026-07-30): the tab defaults to the day timeline, which needs a whole screen
                  // to be readable, while this card defaults to a plain ruled list like its three
                  // siblings. Both offer the other via the layout picker.
                  spec={todoSpec}
                  padState={todoState}
                  onPadStateChange={setTodoState}
                  // The day log (2026-08-02). This is what satisfies the feature's "a card on
                  // Home showing what happened today, plus a capture field" — the card is
                  // already here and already has a pad type-line, so there is no fifth Home
                  // card and no HOME_CARD_KINDS change. (HomeGoalsCard shipped as a fifth card
                  // on 2026-07-28 and was deleted the next day: "Home had too many lists".)
                  dayLog={dayLog}
                  onPressEntry={handlePressLogEntry}
                  onRemoveMoment={removeMoment}
                  onCaptureMoment={addMoment}
                  // ⚠️ **No `onSeeMore` since 2026-08-22**, and no measure wrapper either.
                  // PlanTaskCard's non-embedded shell is components/Card.tsx now, so the card
                  // registers itself as `homeToday`, owns its own `useCardExpand` and its own
                  // outermost ref, and its TITLE is the full-screen control like every other
                  // card's. Home held both the hook and the ref while this file drew a
                  // hand-rolled header; keeping them would be a second measure box around the
                  // one Card already measures. (`onSeeMore` still exists on the component for
                  // its empty-day ghost add-row, which is suppressed here by `onAddTask`.)
                />
        </DebugNoteAnchor>
      </TourTarget>
    ),
    [
      todayTasks, tasks, deletedTasks, dayLog, todoSpec, todoState, setTodoState,
      planTimelineHorizontal, handleToggleTask, handleAddTask, handleAddTaskAndEdit,
      handleDeleteTask, handleRestoreTask, handleAddExampleTask, handlePressLogEntry,
      removeMoment, addMoment, styles.section,
    ]
  );


  // ⚠️ **Each card is memoised SEPARATELY, and that is the point (perf, 2026-09-08).**
  // This object used to be rebuilt whole on every Home render, so a new element identity for
  // EVERY card meant one note changing re-rendered the shopping card, the to-do card and the
  // day log with it. Home subscribes to a lot (tasks, notes, shopping, moments, energy, the
  // clock via `nowMinutes`), so "every Home render" is often. Keeping each entry behind its own
  // deps lets React bail out on the untouched siblings by element identity — which also covers
  // components/Card.tsx itself, whose `children` prop makes it unmemoisable from the outside.
  //
  // A dep list here must name everything the card's JSX reads. Getting one wrong shows up as a
  // card that stops updating, not as a crash — if a Home card ever goes stale, look here first.
  const cardNodes: Partial<Record<CardKey, React.ReactNode>> = {
    homeNotes: notesNode,
    homeToday: todayNode,
  };

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
        // **Home names its hue (2026-08-27, round 20).** It passed no `screenKey` at all, so
        // `useScreenColor()` was null for the whole screen and every categorical control on it
        // fell back to `theme.accent` — which is why the Energy card's button glowed BLUE on the
        // one tab the mockup draws in the to-do gold. The bottom nav had already been drawing
        // Home's own tab gold for months (components/BottomNav.tsx's `navTabHue` resolves the
        // `/` route to 'index'), so the screen and its tab disagreed about what colour Home is.
        // `SCREEN_TOKEN.index` has said `featTask` since the 5→3 merge; this is the second half
        // of that, which was simply never wired up.
        screenKey="index"
        isHome
        bottomNav={false}
        pagerFloatingNav
        ownBackground={false}
        onManageCardsPress={() => setManageCardsOpen(true)}
      >
        <View style={styles.content}>
          {/* ⚠️ **The ⓘ hint banner is GONE (2026-08-20)** — see the header. Its BODY was two
              notification switches (task reminders, the weekly nudge), and deleting them loses
              nothing: both are in app/settings.tsx's `NOTIF_SWITCHES`, which is the inventory,
              and the Settings copies additionally ask for the OS permission through
              `applyAndSync` — which these two hand-rolled ones only half did. */}
          {/* Energy STRIP (2026-07-31, addendum task B.2) — no longer a card: one thin line of
              pips + `n / n` + an edit glyph, with its permanent explainer under it. It is FIXED
              here: not a card in lib/cardRegistry.ts, so it can be neither reordered nor
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

          {/* Today/Notes/Shopping previews — order from settings.cardOrder, visibility from
              settings.hiddenCards, both through the one "Manage cards" header control. The
              Retired shelf that used to sit under these is GONE: the sheet lists every card
              present-or-absent, so a shelf would be a second place saying the same thing. */}
          {cardOrder.map((id) => (cardNodes[id] ? <React.Fragment key={id}>{cardNodes[id]}</React.Fragment> : null))}

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
      <ManageCardsSheet visible={manageCardsOpen} screen="home" onClose={() => setManageCardsOpen(false)} />
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
  // ⚠️ **No top margin (consistency audit, 2026-08-21).** This carried `marginTop: Spacing.xs`
  // — a 4px hair kept from the days when the greeting sat above it. With the greeting gone
  // (2026-08-20) what is above it is the scaffold's own top edge, which every other tab screen
  // meets flush at 0, so Home was the ONE screen whose first child did not start at the header's
  // glass — and, because the strip is gated on `energySystemEnabled`, the same screen measured
  // 4px or 0px depending on a setting. The gap BELOW it is unaffected: the content container's
  // `gap: SCREEN_GAP` owns that, as it does for every other pair of siblings here.
  energyStrip: {},
  pointsText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
