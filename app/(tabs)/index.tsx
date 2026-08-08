/**
 * index.tsx — Home screen (the daily landing hub).
 *
 * The app's calm daily overview. Mounts via ScreenScaffold (Decision 001): the scaffold owns
 * the background, particles, header chrome (Settings gear + Focus eye), and BottomNav; this
 * screen only supplies content and wires Focus mode.
 *
 * **Render order, and which parts of it the user can move** (settled 2026-07-31, addendum
 * task B.2):
 *   1. Greeting + date — fixed (its own `header` block).
 *   2. Energy STRIP (components/EnergyMeter.tsx) — fixed, and absent entirely when
 *      `settings.energySystemEnabled` is off. Not a card any more: one thin line, no surface.
 *   3. Shared card (components/HomeSharedCard.tsx) — fixed, and only present when something
 *      has actually arrived (`hasIncomingShared`). It sits ABOVE the four lists on purpose:
 *      it is transient, time-sensitive and from another person, so below four lists it would
 *      be missed. Interruptive content goes high or it does not work. Don't demote it.
 *   4–7. To-do / Habits / Notes / Shopping — the ONLY reorderable, removable cards, driven by
 *      `settings.homeCardOrder` through components/HomeCardManager.tsx (long-press to drag,
 *      "Edit cards" for the ×/add chrome, floor of one card).
 *   8. The cumulative "you've done N things" line — fixed to the bottom, and the last child
 *      of `content` so it cannot be reordered into the stack.
 * Items 2, 3 and 8 are fixed *structurally*: they are siblings of `HomeCardManager`, not
 * entries in `HOME_CARD_KINDS`, so there is no code path that can drag or delete them.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/PlanTaskCard, components/EnergyMeter
 *             (the fixed Energy strip, gated on settings.energySystemEnabled), components/HomeHabitsCard
 *             (self-contained — reads useHabitStore directly, no props from this screen),
 *             components/HomeNotesCard, components/HomeSharedCard (gated on
 *             settings.featureSharing; the shopping the spend-pace line is unconditional as
 *             of the 2026-07-25 defaults revision), components/HomeShoppingCard, components/HomeCardManager,
 *             components/FlightOverlay (FlightPill, Flight, FlightRect), components/DebugNoteAnchor,
 *             constants/theme, lib/db, lib/date, lib/i18n, lib/siteNav, lib/shoppingGroups,
 *             lib/useAppTheme, lib/useFirstVisitHint, lib/notifications, lib/reminders,
 *             lib/budget (computeSpendPace), lib/useDayLog + lib/dayLog (the day log — what
 *             already happened today, passed into PlanTaskCard so its now-line becomes the
 *             boundary; this card is why the feature needs no Home card of its own),
 *             lib/useNowMinutes, store/useMomentsStore (manual capture + delete),
 *             store/useTaskStore, store/useNotesStore, store/useSharedStore,
 *             store/useShoppingStore, store/useShoppingListStore, store/useMonthlyListStore, store/useSettingsStore, store/useReceiptStore
 *   Used by → Expo Router route "/" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads useTaskStore (tasks + deletedTasks, the restorable tombstones behind the
 *             day-view's "Recently deleted" drawer) + useNotesStore (notes) +
 *             useSharedStore (incoming shared tasks/shopping) + useShoppingStore (items) +
 *             useShoppingListStore (currentList(today)) + useReceiptStore (receipts, for the
 *             Shopping preview card's spend-pace line); mutates via toggle / toggleCheck /
 *             toggleCollected / adjustAmount / putBackToInventory / removeWithSource.
 *             Settings via useSettingsStore (monthlyResetDate) + useMonthlyListStore (each list's
 *             own budgetNok/lastReset — Shopping/Monthly redesign, 2026-07-22, replacing the old
 *             single global monthlyBudgetNok/lastMonthlyReset settings).
 *
 * Edit notes:
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus effect
 *     only resets the hint on blur — no per-screen initDb/load.
 *   - **The ⓘ hint no longer auto-opens on first visit (2026-07-31)** — it is collapsed until
 *     tapped, like every other screen (lib/useFirstVisitHint.ts). Its body still holds the ONLY
 *     copy of the task-notification and weekly-reminder opt-ins (`hintSetting` rows below), so
 *     those are now reached by a deliberate ⓘ tap. They were deliberately left where they are:
 *     re-homing them is a separate design decision, not a side effect of this change.
 *   - **Plans preview = PlanTaskCard read-only (Decision 009a)**: the preview IS the
 *     day-view rendered read-only, with a "See everything →" link to /plans. Not a bespoke card.
 *     `readOnly` only disables row tap-through here (no `onPressTask`/`onSeeMore` passed) — the
 *     done-toggle stays live because `onToggleTask` is passed alongside `readOnly`, so tapping a
 *     task's checkbox toggles it done without opening the editor. `onAddTask` (handleAddTask) is
 *     likewise passed alongside `readOnly` so the preview's trailing AddRow can create an undated
 *     today task inline (mirrors plans.tsx's Whenever quick-add) — no trip to /plans needed.
 *     Same "gate on the callback, not on readOnly" rule covers the 2026-07-27 additions:
 *     `onDeleteTask`/`deletedTasks`/`onRestoreTask` (per-row trash + the "Recently deleted"
 *     restore drawer — the delete is a tombstone, so no confirm dialog; the drawer is the undo)
 *     and `onAddExample` (the empty day's one-tap suggested task).
 *     `allTasks` (full store) is passed so Decision 020 cross-date followers surface.
 *     `horizontal={settings.planTimelineHorizontal}` is threaded to the PlanTaskCard mount.
 *   - **Habits preview = HomeHabitsCard (2026-07-28)**: self-contained, unlike the other
 *     three previews — it reads useHabitStore directly rather than through props, since
 *     Habits needs no cross-store aggregation the way Shopping (budget/receipts) or Plans
 *     (cross-date followers) do. Positioned right after 'plans' in `HOME_CARD_KINDS` and the
 *     default `homeCardOrder` (store/useSettingsStore.ts + lib/db.ts's back-fill migration
 *     for pre-existing installs whose persisted order predates this card).
 *   - **Notes preview = HomeNotesCard**: reads useNotesStore, shows first 5 active notes with
 *     inline toggle-checked, a mic button for voice-capture notes, a trailing AddRow to type a
 *     new note's title directly (no navigation away from Home), and a title tap → /notes for
 *     the full screen / "See all →" when the list overflows. When empty it renders a short
 *     italic bulb explainer (`t.starters.notes.text`, 2026-07-28) at the compact resting height
 *     (does NOT self-hide).
 *   - **Shopping preview = HomeShoppingCard**: shows first 4 items flat when collapsed; full
 *     nested dish-group ExpandableCard structure when expanded. Tick-to-buy, cart-collect and
 *     catalog-vs-adhoc remove preserved; the row's inline qty stepper is gone (row rule,
 *     2026-07-28) — the card opens components/ShoppingItemSheet.tsx itself, so Home no longer
 *     threads increment/decrement handlers down. Also passed a `pace` prop (Decision 026,
 *     lib/budget.ts's computeSpendPace() over useReceiptStore + useMonthlyListStore) — an
 *     aggregate across every Monthly list (summed budget vs. every tagged receipt, paced
 *     against the most recently reset list — see the shoppingPace memo below), the same shape
 *     of figure shown on app/budget.tsx (there, one specific list) and the Shopping screen's

 *     Monthly tab (there, each list's own); null (card shows nothing extra) until at least one
 *     list has a budget set and has been through a reset. **Quick-add (2026-07-24)**: the card
 *     previously had no inline add at all — `handleAddShoppingItem` now backs its trailing
 *     AddRow, whose extras carry a quantity Stepper and a Weekly/Monthly-list target chip;
 *     `monthlyLists` (already read for `shoppingPace`) is passed straight through for that
 *     chip to cycle over.
 *   - **Task quick-add's essential settings (2026-07-24, energy dropped 2026-08-01)**:
 *     `handleAddTask`'s second argument carries whatever PlanTaskCard's extras row
 *     (time/recurring) the user touched — `buildQuickAddTaskInput` builds the shared
 *     `TaskInput` for both this and `handleAddTaskAndEdit` (the "…" path, which additionally
 *     navigates to the new task's full editor via `expandTaskId`). `monthDay` defaults to
 *     today's day-of-month (not a hardcoded 1) so picking 'monthly' from the chip is a valid
 *     occurrence immediately.
 *   - **Home preview card management (2026-07-19, A2/D1 split 2026-07-23, toggle relocated
 *     2026-07-24)**: off-Focus, Notes/Plans/Shopping render via `HomeCardManager`
 *     (components/HomeCardManager.tsx) in `settings.homeCardOrder` order. Holding any card
 *     always drag-reorders it (long-press's one meaning here); a separate visible "Edit
 *     cards"/"Done" toggle drives the delete-badge + "Add a card" chrome — no longer a side
 *     effect of the long-press. The toggle's `editMode` state now lives here (`cardsEditMode`)
 *     and is rendered inline in the greeting header row (top-right), not as its own row above
 *     the stack — that extra row added a second `marginBottom`, doubling the gap between the
 *     greeting and the first card. `HomeCardManager` takes `editMode` as a controlled prop.
 *     The old "Reorder intentionally omitted, Decision 011 R1" note here no longer applies —
 *     that was about the full /shopping screen's cross-group hit-testing; this reuses
 *     DraggableTaskRow but not that complexity, since Home's cards are plain flat siblings.
 *     `renderHomeCard(kind)` is the per-kind render function passed to it;
 *     `sanitizeHomeCardOrder` defends against a corrupt/legacy settings row.
 *   - **Deliberately NOT ported**: DayTimeline/TaskItem/NextTaskCard Plans stack, the old
 *     pre-rebuild Backlog preview (Habits WAS on this list until 2026-07-28 — see
 *     HomeHabitsCard above), SharedRequestsSection(kind='task'), update-ready banner,
 *     work-mode banner, CoverScreen / SiteSwipeView chrome, automation trigger
 *     ('shopping_opened').
 *   - **"More" links (Decision 036)**: chips to /notes and /meals. Reachability is
 *     data-independent — always shown, independent of whether the previews have any content.
 *   - All visible strings via useT(); today is todayStr() (YYYY-MM-DD).
 *   - **Bottom whitespace (visual-audit, 2026-07-11)**: `content`'s trailing padding was
 *     trimmed from `Spacing.xl` to `Spacing.md` to shrink the empty area below the last
 *     card (before the bottom nav) on short content — the ambient hero backdrop
 *     (HomeHeroBackground) itself is untouched, this only tightens the screen's own
 *     bottom padding.
 *   - **Flight animation (Phase 1, 2026-07-11)**: list→cart toggles inside HomeShoppingCard
 *     fly a `FlightPill` clone; this screen owns the `flights` state and mounts a single
 *     `<FlightOverlay>` as a sibling of `<ScreenScaffold>` (not inside it — scaffold children
 *     scroll inside its internal ScrollView). `handleScreenScroll` clears in-flight flights on
 *     scroll. See app/(tabs)/shopping.tsx's own note and ANIMATION_GUIDELINES.md for the
 *     full pattern.
 *   - **Debug notes (2026-07-13)**: each top-level section is wrapped in DebugNoteAnchor with
 *     a hand-picked stable id (`home.greeting`/`home.notesPreview`/`home.sharedPreview`/
 *     `home.plansPreview`/`home.habitsPreview`/`home.shoppingPreview`) — a no-op unless Debug mode is on
 *     (settings.debugModeEnabled). See that component's header for the long-press/bubble/edit
 *     mechanics; this screen is the one concrete "cards" usage alongside every screen's header.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import PlanTaskCard from '@/components/PlanTaskCard';
import EnergyMeter from '@/components/EnergyMeter';
import HomeNotesCard from '@/components/HomeNotesCard';
import HomeSharedCard from '@/components/HomeSharedCard';
import HomeShoppingCard from '@/components/HomeShoppingCard';
import HomeHabitsCard from '@/components/HomeHabitsCard';
import HomeCardManager from '@/components/HomeCardManager';
import type { CardMenu } from '@/components/CardMenuSheet';
import FlightOverlay, { FlightPill, Flight, FlightRect } from '@/components/FlightOverlay';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';
import PressableScale from '@/components/PressableScale';
import { goToSite } from '@/lib/siteNav';
import { todayStr, getWeekRangeContaining, weekOfMonthlyCycle, dateRangeForCycleWeek, formatDateRange } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { computeListGroups } from '@/lib/shoppingGroups';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing, Type, HitSlop } from '@/constants/theme';
import { Task, Recurring, useTaskStore } from '@/store/useTaskStore';
import { SharedShoppingItem, SharedTask, useSharedStore } from '@/store/useSharedStore';
import { ShoppingItem, useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { useSurfaceLayout } from '@/lib/useSurfaceLayout';
import { useDayLog } from '@/lib/useDayLog';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { DayEntry } from '@/lib/dayLog';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useCardState } from '@/lib/useCardState';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { computeSpendPace } from '@/lib/budget';

// Home preview card management (hold-to-manage, components/HomeCardManager.tsx). These
// are the only kinds HomeCardManager knows about — HomeSharedCard is a separate,
// automatic/data-driven inbox, not a discretionary card, so it stays outside this set.
// 'habits' sits right after 'plans' (2026-07-28, user report: "Habits card must be added
// to home screen under to-do") — this order is also the fallback default whenever a
// persisted homeCardOrder is empty/corrupt (see sanitizeHomeCardOrder below).
// 'goals' was dropped 2026-07-29 (user report: Home had too many lists) — Goals no
// longer has a Home card at all; sanitizeHomeCardOrder below drops a leftover 'goals'
// entry from anyone's already-persisted order for free (unknown kinds are filtered).
// See app/goals.tsx's header for the screen's new entry points (Habits, Plans).
const HOME_CARD_KINDS = ['plans', 'habits', 'notes', 'shopping'] as const;
type HomeCardKind = (typeof HOME_CARD_KINDS)[number];

/** Defensive parse for the persisted order: drop unknown/duplicate kinds, fall back to the default order if the result is empty (corrupt/legacy row). */
function sanitizeHomeCardOrder(order: string[]): HomeCardKind[] {
  const seen = new Set<string>();
  const clean = order.filter((k): k is HomeCardKind => {
    if (seen.has(k) || !(HOME_CARD_KINDS as readonly string[]).includes(k)) return false;
    seen.add(k);
    return true;
  });
  return clean.length > 0 ? clean : [...HOME_CARD_KINDS];
}

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const today = todayStr();

  // Collapsed until the header ⓘ is tapped (2026-07-31 — see this file's edit note on the
  // hint's embedded notification settings, and lib/useFirstVisitHint.ts).
  const [hintOpen, setHintOpen] = useFirstVisitHint('home');

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
  const taskNotificationsEnabled = useSettingsStore((s) => s.taskNotificationsEnabled);
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled);
  const userName = useSettingsStore((s) => s.userName);
  const planTimelineHorizontal = useSettingsStore((s) => s.planTimelineHorizontal);
  // Home's to-do card resolves its own layout + size, independently of the To-do tab — see the
  // `spec` prop's comment at the PlanTaskCard mount below.
  const todoSpec = useSurfaceLayout('homeTodo');
  const [todoState, setTodoState] = useCardState('homeTodo');
  const homeCardOrderRaw = useSettingsStore((s) => s.homeCardOrder);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
  const weeklyResetDay = useSettingsStore((s) => s.weeklyResetDay);
  const monthlyLists = useMonthlyListStore((s) => s.lists);
  const updateSettings = useSettingsStore((s) => s.update);
  // All-time counter, maintained by useTaskStore (toggle/completeDirect/remove/
  // clearAll) so it survives pruneOldData() pruning old completed tasks — see
  // store/useTaskStore.ts's "All-time completed-task counter" edit note.
  const completedCount = useSettingsStore((s) => s.lifetimeCompletedTasks);

  const homeCardOrder = useMemo(() => sanitizeHomeCardOrder(homeCardOrderRaw), [homeCardOrderRaw]);
  const homeCardLabels = useMemo(
    () => ({
      notes: t.home.manageCards.kinds.notes,
      plans: t.home.manageCards.kinds.plans,
      shopping: t.home.manageCards.kinds.shopping,
      habits: t.home.manageCards.kinds.habits,
    }),
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        setHintOpen(false);
      };
    }, [setHintOpen])
  );

  // These derived views used to recompute on EVERY render (each is a full-array filter/
  // sort; computeListGroups also groups by dish). Memoise them on the store state they read
  // — `tasksForDate`/`currentList` are stable store fn refs, so `tasks` /
  // `shoppingLists` / `shoppingItems` are the real inputs that should drive recompute.
  // `tasks` isn't read in the body but is the real recompute signal (tasksForDate closes
  // over store state, not this variable).
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
  // tab and a moment IS its own record, so those rows aren't pressable rather than
  // navigating somewhere that isn't about them.
  //
  // A task's editor is an expanded TaskCard on a saved row, not a route — app/task-form.tsx
  // was retired 2026-07-23 (UX audit B1, one canonical task editor). This pushed the dead
  // route until 2026-08-08 and simply went nowhere. It now uses the same
  // `?tab=all&expandTaskId=…` handoff as handleAddTaskAndEdit below, which the All tab's
  // `autoExpand={tk.id === expandTaskId}` consumes.
  const handlePressLogEntry = useCallback(
    (entry: DayEntry) => {
      if (entry.kind !== 'task' || !entry.sourceId) return;
      router.push({ pathname: '/plans', params: { tab: 'all', expandTaskId: entry.sourceId } });
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
  const [cardsEditMode, setCardsEditMode] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t.greeting.night;
    if (h < 10) return t.greeting.morning;
    if (h < 17) return t.greeting.day;
    return t.greeting.evening;
  };
  const now = new Date();
  const dateLabel = `${t.days[now.getDay()]} ${now.getDate()}. ${t.months[now.getMonth()]}`;

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
  // Inline quick-add from the Home Plans preview — mirrors app/(tabs)/plans.tsx's Whenever
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
  // full editor (TaskCard, on /plans) pre-filled, via the expandTaskId param plans.tsx already
  // wires for exactly this (built for a note's "Add to plans" flow, previously uncalled).
  // `tab: 'all'` because expandTaskId's autoExpand lives on the Whenever section's TaskCard,
  // not Today's — and an undated (hasStartDate:false) task like this always shows there too.
  // An EMPTY title is a real case (2026-08-05): "More options" is pressable the moment the
  // quick-add line is focused, so it must always lead somewhere rather than silently doing
  // nothing. With nothing typed there is no task worth creating — an untitled row would be
  // junk the user then has to clean up — so it just opens the To-do screen, which is the
  // "more options" the press was asking for.
  const handleAddTaskAndEdit = useCallback(
    (title: string, extra: { time?: string; recurring: Recurring; recurringDays: number[] }) => {
      if (!title) {
        router.push({ pathname: '/plans', params: { tab: 'all' } });
        return;
      }
      const task = addTask(buildQuickAddTaskInput(title, extra));
      router.push({ pathname: '/plans', params: { tab: 'all', expandTaskId: task.id } });
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
      // Home keeps at least one card — hiding the last one leaves a screen with a greeting
      // and nothing else, and no visible way back (the add-picker lives inside edit mode).
      const isLast = homeCardOrder.length <= 1;
      return {
        options: [
          {
            key: 'hide',
            label: t.home.cardMenu.hide,
            icon: 'eye-off-outline',
            hint: isLast ? t.home.cardMenu.hideLastHint : t.home.cardMenu.hideHint,
            disabled: isLast,
            onPress: () => updateSettings({ homeCardOrder: homeCardOrder.filter((k) => k !== kind) }),
          },
        ],
        // The hand-off to the drag mode HomeCardManager already owns — not a second
        // reorder implementation. It only makes sense with something to reorder against.
        onEditLayout: isLast ? undefined : () => setCardsEditMode(true),
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
              />
            </DebugNoteAnchor>
          </TourTarget>
        );
      case 'habits':
        return (
          <DebugNoteAnchor id="home.habitsPreview" label="Home — Habits preview" style={styles.section}>
            <HomeHabitsCard cardMenu={buildCardMenu('habits')} />
          </DebugNoteAnchor>
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
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
        onScroll={handleScreenScroll}
      >
        <View style={styles.content}>
          <HintCard text={t.hints.home.text} example={t.hints.home.example} open={hintOpen} noPill>
            <View style={[styles.hintSetting, { borderTopColor: theme.hintBorder }]}>
                <View style={styles.hintSettingRow}>
                  <Text style={[styles.hintSettingLabel, { color: theme.text }]}>{t.taskNotifications}</Text>
                  <Switch
                    value={taskNotificationsEnabled}
                    onValueChange={(v) => {
                      updateSettings({ taskNotificationsEnabled: v });
                      const resync = () => useTaskStore.getState().syncAllTaskNotifications();
                      if (v) requestPermissions().finally(resync);
                      else resync();
                    }}
                    trackColor={{ false: theme.border, true: theme.accentSoft }}
                    thumbColor={taskNotificationsEnabled ? theme.accent : theme.textMuted}
                  />
                </View>
                <View style={styles.hintSettingRow}>
                  <Text style={[styles.hintSettingLabel, { color: theme.text }]}>{t.weeklyRemindersOnboarding}</Text>
                  <Switch
                    value={remindersEnabled}
                    onValueChange={(v) => {
                      updateSettings({ remindersEnabled: v });
                      if (v) requestPermissions().finally(() => syncReminders());
                      else syncReminders();
                    }}
                    trackColor={{ false: theme.border, true: theme.accentSoft }}
                    thumbColor={remindersEnabled ? theme.accent : theme.textMuted}
                  />
                </View>
              </View>
          </HintCard>

          {/* Greeting — also hosts the "Edit cards" / "Done" toggle inline (top-right) so it
              doesn't add its own row/margin between the greeting and the first preview card. */}
          <DebugNoteAnchor id="home.greeting" label="Home — Greeting">
            <View style={styles.header}>
              <View style={styles.headerTextCol}>
                <Text style={[styles.greeting, { color: theme.text }]}>
                  {greeting()}{userName ? `, ${userName}` : ''}!
                </Text>
                <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{dateLabel}</Text>
              </View>
              {cardsEditMode ? (
                <PressableScale
                  style={[styles.doneBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    tap();
                    setCardsEditMode(false);
                  }}
                >
                  <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.home.manageCards.done}</Text>
                </PressableScale>
              ) : (
                <PressableScale
                  style={styles.editEntryBtn}
                  onPress={() => {
                    tap();
                    setCardsEditMode(true);
                  }}
                  hitSlop={HitSlop.base}
                  accessibilityRole="button"
                  accessibilityLabel={t.home.manageCards.edit}
                >
                  <Ionicons name="pencil-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.editEntryBtnText, { color: theme.textMuted }]}>{t.home.manageCards.edit}</Text>
                </PressableScale>
              )}
            </View>
          </DebugNoteAnchor>

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
            editMode={cardsEditMode}
            onReorder={(next) => updateSettings({ homeCardOrder: next })}
            onRemove={(kind) => updateSettings({ homeCardOrder: homeCardOrder.filter((k) => k !== kind) })}
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
      <FlightOverlay flights={flights} onFlightEnd={handleFlightEnd} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  blank: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  // Embedded first-run settings inside the ⓘ hint (notification opt-in).
  hintSetting: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.sm },
  hintSettingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  hintSettingLabel: { flex: 1, fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  // marginBottom matches every card's own trailing marginBottom (Spacing.sm) so the
  // greeting→first-preview gap equals the gaps between previews (each = card marginBottom
  // + section marginTop). Without it the first gap was 8px short — the "uneven" rhythm.
  // Row layout (2026-07-24): the "Edit cards"/"Done" toggle now lives inline here (top-right)
  // instead of its own row above the card stack — that used to add a second marginBottom
  // on top of this one, doubling the greeting→first-card gap.
  header: { marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTextCol: { flex: 1 },
  // Home's big "Hei, Name" greeting — the screen's title role (2026-07-18: was xxl/semibold,
  // now Type.title for the refreshed hierarchy).
  greeting: { fontFamily: Type.title.fontFamily, fontSize: Type.title.size, lineHeight: Math.round(Type.title.size * Type.title.line) },
  dateLabel: { fontSize: FontSize.sm, marginTop: Spacing.xs, textTransform: 'capitalize', fontFamily: Fonts.regular },
  section: { marginTop: Spacing.xl },
  // The Energy strip is chrome, not a card, so it gets a card-gap's worth of space BELOW it
  // (the next section's own Spacing.xl) but only a hair above — the greeting's own
  // marginBottom (Spacing.sm) is already the separation it needs.
  energyStrip: { marginTop: Spacing.xs },
  pointsText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
  // "Edit cards" / "Done" toggle for the Notes/Plans/Shopping stack (moved here from
  // HomeCardManager's own row, 2026-07-24 — see the header comment above).
  doneBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.sm },
  editEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  editEntryBtnText: { fontFamily: Fonts.medium, fontSize: FontSize.xs },
});
