/**
 * index.tsx — Home screen (the daily landing hub).
 *
 * The app's calm daily overview: a low-weight greeting, then the three converged
 * previews — Notes (HomeNotesCard), Plans (the shared PlanTaskCard day-view), and
 * Shopping (HomeShoppingCard) — plus gentle completed-count points. Mounts via
 * ScreenScaffold (Decision 001): the scaffold owns the background, particles, header
 * chrome (Settings gear + Focus eye), and BottomNav; this screen only supplies
 * content and wires Focus mode.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/PlanTaskCard, components/HomeNotesCard,
 *             components/HomeSharedCard, components/HomeShoppingCard, components/HomeCardManager,
 *             components/FlightOverlay (FlightPill, Flight, FlightRect), components/DebugNoteAnchor,
 *             constants/theme, lib/db, lib/date, lib/i18n, lib/siteNav, lib/shoppingGroups,
 *             lib/useAppTheme, lib/useFirstVisitHint, lib/screenColor, lib/notifications, lib/reminders,
 *             lib/budget (computeSpendPace), store/useTaskStore, store/useNotesStore, store/useSharedStore,
 *             store/useShoppingStore, store/useShoppingListStore, store/useMonthlyListStore, store/useSettingsStore, store/useReceiptStore
 *   Used by → Expo Router route "/" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads useTaskStore (tasks) + useNotesStore (notes) + useSharedStore (incoming
 *             shared tasks/shopping) + useShoppingStore (items) +
 *             useShoppingListStore (currentList(today)) + useReceiptStore (receipts, for the
 *             Shopping preview card's spend-pace line); mutates via toggle / toggleCheck /
 *             toggleCollected / adjustAmount / putBackToInventory / removeWithSource.
 *             Settings via useSettingsStore (monthlyResetDate) + useMonthlyListStore (each list's
 *             own budgetNok/lastReset — Shopping/Monthly redesign, 2026-07-22, replacing the old
 *             single global monthlyBudgetNok/lastMonthlyReset settings).
 *
 * Edit notes:
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus effect
 *     only resets the first-visit hint on blur — no per-screen initDb/load.
 *   - **Plans preview = PlanTaskCard read-only (Decision 009a)**: the preview IS the
 *     day-view rendered read-only, with a "See everything →" link to /plans. Not a bespoke card.
 *     `readOnly` only disables row tap-through here (no `onPressTask`/`onSeeMore` passed) — the
 *     done-toggle stays live because `onToggleTask` is passed alongside `readOnly`, so tapping a
 *     task's checkbox toggles it done without opening the editor. `onAddTask` (handleAddTask) is
 *     likewise passed alongside `readOnly` so the preview's trailing AddRow can create an undated
 *     today task inline (mirrors plans.tsx's Whenever quick-add) — no trip to /plans needed.
 *     `allTasks` (full store) is passed so Decision 020 cross-date followers surface.
 *     `horizontal={settings.planTimelineHorizontal}` is threaded to the PlanTaskCard mount.
 *   - **Notes preview = HomeNotesCard**: reads useNotesStore, shows first 5 active notes with
 *     inline toggle-checked, a mic button for voice-capture notes, a trailing AddRow to type a
 *     new note's title directly (no navigation away from Home), and a title tap → /notes for
 *     the full screen / "See all →" when the list overflows. When empty it renders the shared
 *     HomePreviewEmpty block at the compact resting height (does NOT self-hide).
 *   - **Shopping preview = HomeShoppingCard**: shows first 4 items flat when collapsed; full
 *     nested dish-group ExpandableCard structure when expanded. Tick-to-buy, cart-collect,
 *     stepper, and catalog-vs-adhoc remove preserved. Also passed a `pace` prop (Decision 026,
 *     lib/budget.ts's computeSpendPace() over useReceiptStore + useMonthlyListStore) — an
 *     aggregate across every Monthly list (summed budget vs. every tagged receipt, paced
 *     against the most recently reset list — see the shoppingPace memo below), the same shape
 *     of figure shown on app/budget.tsx (there, one specific list) and the Shopping screen's
 *     Monthly tab (there, each list's own); null (card shows nothing extra) until at least one
 *     list has a budget set and has been through a reset.
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
 *   - **Deliberately NOT ported**: DayTimeline/TaskItem/NextTaskCard Plans stack, Backlog + Habits
 *     previews, SharedRequestsSection(kind='task'), update-ready banner, work-mode banner,
 *     CoverScreen / SiteSwipeView chrome, automation trigger ('shopping_opened').
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
 *     `home.plansPreview`/`home.shoppingPreview`) — a no-op unless Debug mode is on
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
import HomeCardManager from '@/components/HomeCardManager';
import FlightOverlay, { FlightPill, Flight, FlightRect } from '@/components/FlightOverlay';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import PressableScale from '@/components/PressableScale';
import { goToSite } from '@/lib/siteNav';
import { todayStr } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { computeListGroups } from '@/lib/shoppingGroups';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { getScreenColor } from '@/lib/screenColor';
import { tap } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { SharedShoppingItem, SharedTask, useSharedStore } from '@/store/useSharedStore';
import { ShoppingItem, useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { computeSpendPace } from '@/lib/budget';

// Home preview card management (hold-to-manage, components/HomeCardManager.tsx). These
// are the only kinds HomeCardManager knows about — HomeSharedCard is a separate,
// automatic/data-driven inbox, not a discretionary card, so it stays outside this set.
const HOME_CARD_KINDS = ['plans', 'notes', 'shopping'] as const;
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

  const shoppingItems = useShoppingStore((s) => s.items);
  const toggleShoppingItem = useShoppingStore((s) => s.toggleCheck);
  const toggleShoppingCollected = useShoppingStore((s) => s.toggleCollected);
  const putBackToInventory = useShoppingStore((s) => s.putBackToInventory);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const adjustAmount = useShoppingStore((s) => s.adjustAmount);

  const shoppingLists = useShoppingListStore((s) => s.lists);
  const currentListFn = useShoppingListStore((s) => s.currentList);

  const receipts = useReceiptStore((s) => s.receipts);

  // Mirrors HomeSharedCard's own self-hide check exactly — needed here too so this
  // screen doesn't mount an empty `section` wrapper (marginTop: Spacing.xl) around a
  // card that renders nothing, which was doubling the gap to the next card below it
  // whenever nothing was incoming (the common case).
  const sharedTasks = useSharedStore((s) => s.tasks);
  const sharedShoppingItems = useSharedStore((s) => s.shoppingItems);
  const hasIncomingShared =
    sharedTasks.some((x: SharedTask) => x.direction === 'in' && !x.done) ||
    sharedShoppingItems.some((i: SharedShoppingItem) => i.direction === 'in' && !i.done);

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
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  const homeCardOrderRaw = useSettingsStore((s) => s.homeCardOrder);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
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

  // currentList is a fn ref; `shoppingLists` is the real input, so memo on it (this also
  // replaces the old `void shoppingLists` render-subscription hack).
  const currentShoppingList = useMemo(
    () => currentListFn(today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentListFn, today, shoppingLists]
  );
  const { dishGroups, ungroupedUnchecked, checked } = useMemo(
    () =>
      currentShoppingList
        ? computeListGroups(shoppingItems, currentShoppingList.id)
        : { dishGroups: [], ungroupedUnchecked: [], checked: [] },
    [currentShoppingList, shoppingItems]
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
  // Inline quick-add from the Home Plans preview — mirrors app/(tabs)/plans.tsx's Whenever
  // AddRow: an undated (hasStartDate:false), non-recurring task dated today, so it shows in
  // Today, the day's list, and the All tab's Whenever without any extra sync. Lets a task be
  // created without leaving Home (was: force-navigate to /plans).
  const handleAddTask = useCallback(
    (title: string) => {
      addTask({
        title,
        date: today,
        taskType: 'start-at',
        done: false,
        recurring: 'none',
        recurringDays: [],
        weekInterval: 1,
        monthlyMode: 'day',
        monthDay: 1,
        monthOrdinal: 'first',
        monthWeekday: 0,
        sortOrder: 0,
        hasStartDate: false,
        assignee: '',
      });
    },
    [addTask, today]
  );
  const handleToggleShopping = useCallback((id: string) => toggleShoppingItem(id), [toggleShoppingItem]);
  const handleCollectShopping = useCallback((id: string) => toggleShoppingCollected(id), [toggleShoppingCollected]);
  const handleIncrementShopping = useCallback((id: string) => adjustAmount(id, 1), [adjustAmount]);
  const handleDecrementShopping = useCallback((id: string) => adjustAmount(id, -1), [adjustAmount]);
  const handleNavigateToShopping = useCallback(
    () => goToSite(router, pathname, '/shopping'),
    [router, pathname]
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
            <HomeNotesCard />
          </DebugNoteAnchor>
        );
      case 'plans':
        return (
          <DebugNoteAnchor id="home.plansPreview" label="Home — Plans preview" style={styles.section}>
            <PlanTaskCard
              tasks={todayTasks}
              allTasks={tasks}
              readOnly
              onToggleTask={handleToggleTask}
              onAddTask={handleAddTask}
              horizontal={planTimelineHorizontal}
            />
          </DebugNoteAnchor>
        );
      case 'shopping':
        return (
          <DebugNoteAnchor id="home.shoppingPreview" label="Home — Shopping preview" style={styles.section}>
            <HomeShoppingCard
              list={currentShoppingList}
              dishGroups={dishGroups}
              ungroupedUnchecked={ungroupedUnchecked}
              checked={checked}
              pace={shoppingPace}
              onToggle={handleToggleShopping}
              onCollect={handleCollectShopping}
              onRemove={handleRemoveShoppingItem}
              onIncrement={handleIncrementShopping}
              onDecrement={handleDecrementShopping}
              onNavigateToShopping={handleNavigateToShopping}
              inStockLabel={t.inStockLabel}
              onFlightStart={handleFlightStart}
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
        ownBackground={false}
        screenColor={getScreenColor(theme, 'index').base}
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
        onScroll={handleScreenScroll}
      >
        <View style={styles.content}>
          <HintCard text={t.hints.home.text} open={hintOpen} noPill>
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
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t.home.manageCards.edit}
                >
                  <Ionicons name="pencil-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.editEntryBtnText, { color: theme.textMuted }]}>{t.home.manageCards.edit}</Text>
                </PressableScale>
              )}
            </View>
          </DebugNoteAnchor>

          {/* Energy meter — only when the Energy system is enabled (settings). */}
          {energySystemEnabled && (
            <View style={styles.section}>
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
