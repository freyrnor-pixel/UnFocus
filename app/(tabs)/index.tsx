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
 *             components/HomeHealthCard, components/HomeMedicineCard (each self-contained — they read their own stores and
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
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import EnergyMeter from '@/components/EnergyMeter';
import PlanTaskCard from '@/components/PlanTaskCard';
import HomeNotesCard from '@/components/HomeNotesCard';
import HomeSharedCard from '@/components/HomeSharedCard';
import HomeShoppingCard from '@/components/HomeShoppingCard';
import HomeCardManager from '@/components/HomeCardManager';
import type { CardMenu } from '@/components/CardMenuSheet';
import FlightOverlay, { FlightPill, Flight, FlightRect } from '@/components/FlightOverlay';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';

import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { Fonts, FontSize, SCREEN_GAP, Spacing } from '@/constants/theme';
import { goToSite } from '@/lib/siteNav';
import { todayStr, getWeekRangeContaining, weekOfMonthlyCycle, dateRangeForCycleWeek, formatDateRange } from '@/lib/date';
import { computeListGroups } from '@/lib/shoppingGroups';
import { computeSpendPace } from '@/lib/budget';
import { useSurfaceLayout } from '@/lib/useSurfaceLayout';
import { useCardState } from '@/lib/useCardState';
import { useDayLog } from '@/lib/useDayLog';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { DayEntry } from '@/lib/dayLog';

import { Task, Recurring, useTaskStore } from '@/store/useTaskStore';
import { SharedShoppingItem, SharedTask, useSharedStore } from '@/store/useSharedStore';
import { ShoppingItem, useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { sanitizeHomeCardOrder, type HomeCardKind } from '@/lib/homeCards';

// Home preview card management (hold-to-manage, components/HomeCardManager.tsx). The kinds
// and the persisted-order parse moved to lib/homeCards.ts on 2026-08-20 so the 'habits' →
// 'plans' fold-in could be unit-tested; HomeSharedCard is a separate, automatic/data-driven
// inbox, not a discretionary card, so it stays outside that set either way.
export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const today = todayStr();

  // Flight animation (Phase 1, 2026-07-11) — mirrors app/(tabs)/shopping.tsx's screen-level
  // plumbing at smaller scale (one card, no listId keying needed). See that file's own edit
  // note and ANIMATION_GUIDELINES.md's "Flight / Cross-Section Travel Animations" section.
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightCounter = useRef(0);
  const lastScrollY = useRef(0);

  function handleFlightStart(item: ShoppingItem, from: FlightRect, to: FlightRect) {
    flightCounter.current += 1;
    const key = `${item.id}-${flightCounter.current}`;
    setFlights((prev) => [
      ...prev.filter((f) => f.itemId !== item.id),
      { key, itemId: item.id, from, to, content: <FlightPill label={item.name} /> },
    ]);
  }
  function handleFlightEnd(key: string) {
    setFlights((prev) => prev.filter((f) => f.key !== key));
  }
  function handleScreenScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    if (Math.abs(y - lastScrollY.current) > 4 && flights.length > 0) setFlights([]);
    lastScrollY.current = y;
  }
  const tasks = useTaskStore((s) => s.tasks);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const toggleTask = useTaskStore((s) => s.toggle);
  const addTask = useTaskStore((s) => s.add);
  const removeTask = useTaskStore((s) => s.remove);
  const restoreTask = useTaskStore((s) => s.restore);
  const deletedTasks = useTaskStore((s) => s.deletedTasks);

  const shoppingItems = useShoppingStore((s) => s.items);
  const toggleShoppingItem = useShoppingStore((s) => s.toggleCheck);
  const toggleShoppingCollected = useShoppingStore((s) => s.toggleCollected);
  const putBackToInventory = useShoppingStore((s) => s.putBackToInventory);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const addShoppingItem = useShoppingStore((s) => s.add);

  const shoppingLists = useShoppingListStore((s) => s.lists);
  const currentListFn = useShoppingListStore((s) => s.currentList);
  const addShoppingList = useShoppingListStore((s) => s.add);

  const receipts = useReceiptStore((s) => s.receipts);

  // Home's to-do card resolves its own layout + size, independently of the To-do tab — see the
  // `spec` prop's comment at the PlanTaskCard mount below.
  const todoSpec = useSurfaceLayout('homeTodo');
  const [todoState, setTodoState] = useCardState('homeTodo');
  const planTimelineHorizontal = useSettingsStore((s) => s.planTimelineHorizontal);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
  const weeklyResetDay = useSettingsStore((s) => s.weeklyResetDay);
  const monthlyLists = useMonthlyListStore((s) => s.lists);


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
  // Gates the 'medicine' card only — see `renderHomeCard`'s note on why the gate is here and
  // not in lib/homeCards.ts.
  const featureMedicine = useSettingsStore((s) => s.featureMedicine);
  const updateSettings = useSettingsStore((s) => s.update);
  // All-time counter, maintained by useTaskStore (toggle/completeDirect/remove/
  // clearAll) so it survives pruneOldData() pruning old completed tasks — see
  // store/useTaskStore.ts's "All-time completed-task counter" edit note.
  const completedCount = useSettingsStore((s) => s.lifetimeCompletedTasks);

  const homeCardOrder = useMemo(() => sanitizeHomeCardOrder(homeCardOrderRaw), [homeCardOrderRaw]);
  const homeCardLabels = useMemo(
    () => ({
      plans: t.home.manageCards.kinds.plans,
      notes: t.home.manageCards.kinds.notes,
      shopping: t.home.manageCards.kinds.shopping,
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

  // currentList is a fn ref; `shoppingLists` is the real input, so memo on it (this also
  // replaces the old `void shoppingLists` render-subscription hack).
  const currentShoppingList = useMemo(
    () => currentListFn(today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentListFn, today, shoppingLists]
  );
  /**
   * The Shopping card's four pages — Week 1–4 of the monthly cycle (2026-07-30, user report:
   * "user can tap left/right button to go through different lists"). One entry per week
   * whether or not a list exists for it: a week with no list is a real, visible state ("no
   * list this week"), not a page the arrows skip over, or the pager's length would change
   * under the user's finger.
   *
   * Week ↔ list resolution reuses `weekOfMonthlyCycle`/`dateRangeForCycleWeek` from lib/date —
   * the same helpers app/(tabs)/shopping.tsx buckets its own Week 1–4 sections with, so the two
   * surfaces can't disagree about which week a list belongs to.
   */
  const shoppingWeeks = useMemo(() => {
    const active = shoppingLists.filter((l) => !l.isTemplate);
    return [1, 2, 3, 4].map((week) => {
      const list = active.find((l) => weekOfMonthlyCycle(l.startDate, monthlyResetDate) === week) ?? null;
      const groups = list
        ? computeListGroups(shoppingItems, list.id)
        : { dishGroups: [], ungroupedUnchecked: [], checked: [] };
      return {
        week,
        list,
        range: dateRangeForCycleWeek(today, monthlyResetDate, week, weeklyResetDay),
        ...groups,
      };
    });
  }, [shoppingLists, shoppingItems, monthlyResetDate, weeklyResetDay, today]);

  // Card size for the Shopping pager, persisted per surface like the other pad cards.
  const [shoppingCardState, setShoppingCardState] = useCardState('shopping');
  // Week-range labels are date-formatted, so they need the active language (lib/date's
  // formatDateRange puts the month before/after the day depending on it).
  const language = useSettingsStore((s) => s.language);

  // Which page the pager opens on: the week that actually contains today.
  const currentShoppingWeek = useMemo(
    () => weekOfMonthlyCycle(today, monthlyResetDate),
    [today, monthlyResetDate]
  );

  // Spend-vs-budget pace (Decision 026), shared with app/budget.tsx and the Shopping
  // screen's Monthly tab via lib/budget.ts's computeSpendPace() — null when no budget
  // is set yet, in which case HomeShoppingCard just omits the line. Shopping — Monthly
  // redesign (2026-07-22): budget is per Monthly list now, so this ONE preview line
  // aggregates across every list — total budget (sum of each list's budgetNok) vs. every
  // receipt tagged to any Monthly list, paced against the most recently reset list's
  // lastReset (in the common single-list case this is exactly that list's own boundary,
  // unchanged from before). A per-list breakdown lives on the Shopping screen itself.
  const shoppingPace = useMemo(() => {
    const totalBudget = monthlyLists.reduce((sum, l) => sum + l.budgetNok, 0);
    const listIds = new Set(monthlyLists.map((l) => l.id));
    const taggedReceipts = receipts.filter((r) => r.monthlyListId && listIds.has(r.monthlyListId));
    const latestReset = monthlyLists.map((l) => l.lastReset).filter(Boolean).sort().pop() ?? '';
    return computeSpendPace(taggedReceipts, totalBudget, monthlyResetDate, latestReset);
  }, [receipts, monthlyLists, monthlyResetDate]);

  // Home card edit mode (delete/add chrome for the Notes/Plans/Shopping stack) — lifted
  // up from HomeCardManager so its "Edit cards"/"Done" toggle can sit inline in the
  // greeting header row instead of its own row above the stack (see the header comment
  // below for why that matters for the greeting→first-card gap).
  // Stable callbacks (store action refs are themselves stable), so the memoised list rows
  // inside HomeShoppingCard / PlanTaskCard can actually bail out of re-rendering instead of
  // getting a fresh closure every parent render.
  const handleRemoveShoppingItem = useCallback(
    (item: ShoppingItem) => {
      if (item.fromCatalog) putBackToInventory(item.id);
      else removeWithSource(item.id);
    },
    [putBackToInventory, removeWithSource]
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

  // Inline quick-add from the Home Shopping preview — new (2026-07-24), the card previously had
  // no add affordance at all. `monthlyListId` present = a Monthly catalog item (mirrors
  // shopping.tsx's own catalog add); absent = an ad-hoc item on the current week's list (mirrors
  // shopping.tsx's handleDecrementCartItem ad-hoc add). A brand-new profile that's never opened
  // /shopping has no week list yet (currentList() only reads, never creates) — auto-create one
  // the same way shopping.tsx's own "+ New list" (handleCreateNewWeeklyList) does, so the quick
  // add never silently no-ops. addShoppingList() returns the new id synchronously, so the item
  // can be attached to it in the same call without waiting for a re-render.
  const handleAddShoppingItem = useCallback(
    (name: string, quantity: number, monthlyListId?: string) => {
      if (monthlyListId) {
        addShoppingItem({
          name,
          amount: String(quantity),
          unit: '',
          listType: 'monthly',
          store: '',
          price: 0,
          inventoryQty: 0,
          status: 'catalog',
          targetQuantity: quantity,
          monthlyListId,
        });
        return;
      }
      const listId = currentShoppingList?.id ?? addShoppingList(getWeekRangeContaining(today, weeklyResetDay));
      addShoppingItem({
        name,
        amount: String(quantity),
        unit: '',
        listType: 'weekly',
        store: '',
        price: 0,
        inventoryQty: 0,
        status: 'inWeeklyList',
        listId,
      });
    },
    [addShoppingItem, currentShoppingList, addShoppingList, today, weeklyResetDay]
  );
  const handleToggleShopping = useCallback((id: string) => toggleShoppingItem(id), [toggleShoppingItem]);
  const handleCollectShopping = useCallback((id: string) => toggleShoppingCollected(id), [toggleShoppingCollected]);
  const handleNavigateToShopping = useCallback(
    () => goToSite(router, pathname, '/shopping'),
    [router, pathname]
  );

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
      case 'plans':
        return (
          <TourTarget id="tour.home.today">
            <DebugNoteAnchor id="home.plansPreview" label="Home — Plans preview" style={styles.section}>
                <PlanTaskCard
                  cardMenu={buildCardMenu('plans')}
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
        );
      case 'shopping':
        return (
          <DebugNoteAnchor id="home.shoppingPreview" label="Home — Shopping preview" style={styles.section}>
            <HomeShoppingCard
              cardMenu={buildCardMenu('shopping')}
              // Four pages, one per cycle week (2026-07-30) — see the `shoppingWeeks` memo.
              weeks={shoppingWeeks}
              initialWeek={currentShoppingWeek}
              formatRange={(startDate, endDate) => formatDateRange(startDate, endDate, t.monthsShort, language)}
              pace={shoppingPace}
              onToggle={handleToggleShopping}
              onCollect={handleCollectShopping}
              onRemove={handleRemoveShoppingItem}
              onNavigateToShopping={handleNavigateToShopping}
              onAddItem={handleAddShoppingItem}
              monthlyLists={monthlyLists}
              onFlightStart={handleFlightStart}
              padState={shoppingCardState}
              onPadStateChange={setShoppingCardState}
            />
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
        onScroll={handleScreenScroll}
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
      {/* ⚠️ A SIBLING of ScreenScaffold, never a child: the scaffold's children scroll inside its
          own clipped viewport, and a flight has to cross the whole screen. Back on Home since
          2026-08-22 with the Shopping card it belongs to — see handleFlightStart above and
          ANIMATION_GUIDELINES.md's "Flight / Cross-Section Travel Animations". */}
      <FlightOverlay flights={flights} onFlightEnd={handleFlightEnd} />
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
