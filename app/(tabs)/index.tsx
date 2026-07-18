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
 *             components/HomeSharedCard, components/HomeShoppingCard,
 *             components/FlightOverlay (FlightPill, Flight, FlightRect), components/DebugNoteAnchor,
 *             constants/theme, lib/db, lib/date, lib/i18n, lib/siteNav, lib/shoppingGroups,
 *             lib/useAppTheme, lib/useFirstVisitHint, lib/notifications, lib/reminders,
 *             store/useTaskStore, store/useNotesStore, store/useSharedStore,
 *             store/useShoppingStore, store/useShoppingListStore, store/useSettingsStore
 *   Used by → Expo Router route "/" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads useTaskStore (tasks) + useNotesStore (notes) + useSharedStore (incoming
 *             shared tasks/shopping) + useShoppingStore (items) +
 *             useShoppingListStore (currentList(today)); mutates via toggle / toggleCheck /
 *             toggleCollected / adjustAmount / putBackToInventory / removeWithSource.
 *             Settings via useSettingsStore.
 *
 * Edit notes:
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus effect
 *     only reseeds Focus mode's ephemeral default (see below) — no per-screen initDb/load.
 *   - **Focus mode (Decisions 009 #4 / 018)**: Home-only, session-ephemeral local state. Its
 *     DEFAULT is seeded from the persisted `essentialsModeEnabled` "Focus mode" setting on every
 *     focus-in, and leaving the screen resets it back to that default (not a hardcoded OFF) — so
 *     the settings toggle (previously inert) and the header eye are ONE feature: a saved default
 *     plus a live session toggle, not two unrelated things that happened to share the name "Focus".
 *     The header eye toggles it (props threaded through ScreenScaffold → ScreenHeader).
 *     ON: hides the Notes + Shopping previews + points (no input affordances), leaving only
 *     the Plans surface filtered to `importance === 'essential'` (Decision 018 — the two-value
 *     `importance` field IS the intensity model; no energy path). The done-toggle stays live in
 *     focus (completing a task is "doing the thing", not input), so PlanTaskCard is mounted
 *     non-readOnly but WITHOUT `onPressTask`/`onSeeMore` — the row done-dot works, tap-through to
 *     the editor does not. Completing the last essential task → PlanTaskCard's own gentle
 *     `dayViewAllDone` state (Decision 009 #4 "gentle done-state, not an empty screen").
 *   - **Plans preview = PlanTaskCard read-only (Decision 009a)**: OFF-focus, the preview IS the
 *     day-view rendered read-only, with a "See everything →" link to /plans. Not a bespoke card.
 *     `readOnly` only disables row tap-through here (no `onPressTask`/`onSeeMore` passed) — the
 *     done-toggle stays live because `onToggleTask` is passed alongside `readOnly`, so tapping a
 *     task's checkbox toggles it done without opening the editor.
 *     `allTasks` (full store) is passed so Decision 020 cross-date followers surface.
 *     `horizontal={settings.planTimelineHorizontal}` is threaded to both PlanTaskCard mounts
 *     (Focus + preview) so the rail-orientation setting applies in both modes.
 *   - **Notes preview = HomeNotesCard**: reads useNotesStore, shows first 5 active notes with
 *     inline toggle-checked, quick-add (→ /notes), and "See all →" link. When empty it renders
 *     the shared HomePreviewEmpty block at the compact resting height (does NOT self-hide).
 *   - **Shopping preview = HomeShoppingCard**: shows first 4 items flat when collapsed; full
 *     nested dish-group ExpandableCard structure when expanded. Reorder intentionally omitted
 *     (Decision 011 R1). Tick-to-buy, cart-collect, stepper, and catalog-vs-adhoc remove preserved.
 *   - **Deliberately NOT ported**: DayTimeline/TaskItem/NextTaskCard Plans stack, Backlog + Habits
 *     previews, SharedRequestsSection(kind='task'), update-ready banner, work-mode banner,
 *     CoverScreen / SiteSwipeView chrome, automation trigger ('shopping_opened').
 *   - **"More" links (Decision 036)**: off-Focus chips to /notes and /meals. Reachability is
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
import ScreenScaffold from '@/components/ScreenScaffold';
import PlanTaskCard from '@/components/PlanTaskCard';
import HomeNotesCard from '@/components/HomeNotesCard';
import HomeSharedCard from '@/components/HomeSharedCard';
import HomeShoppingCard from '@/components/HomeShoppingCard';
import FlightOverlay, { FlightPill, Flight, FlightRect } from '@/components/FlightOverlay';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import { goToSite } from '@/lib/siteNav';
import { todayStr } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { computeListGroups } from '@/lib/shoppingGroups';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { FontSize, Fonts, Spacing, Type } from '@/constants/theme';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { useNotesStore } from '@/store/useNotesStore';
import { SharedShoppingItem, SharedTask, useSharedStore } from '@/store/useSharedStore';
import { ShoppingItem, useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const today = todayStr();

  // Focus mode: Home-only, ephemeral (Decisions 009 #4 / 018). Reset on blur below.
  const [focusMode, setFocusMode] = useState(false);
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
  const completedCountFn = useTaskStore((s) => s.completedCount);

  const shoppingItems = useShoppingStore((s) => s.items);
  const toggleShoppingItem = useShoppingStore((s) => s.toggleCheck);
  const toggleShoppingCollected = useShoppingStore((s) => s.toggleCollected);
  const putBackToInventory = useShoppingStore((s) => s.putBackToInventory);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const adjustAmount = useShoppingStore((s) => s.adjustAmount);

  const shoppingLists = useShoppingListStore((s) => s.lists);
  const currentListFn = useShoppingListStore((s) => s.currentList);

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
  const updateSettings = useSettingsStore((s) => s.update);

  useFocusEffect(
    useCallback(() => {
      // Focus mode's default is the persisted "Focus mode" setting
      // (essentialsModeEnabled). The header eye still toggles it live for the
      // session; leaving Home resets it back to that default. This keeps the
      // toggle ephemeral within a session (Decision 009 #4) while making the
      // settings toggle — which was otherwise inert — the source of the default,
      // so the two "Focus mode" surfaces are one coherent feature, not two.
      const defaultFocus = useSettingsStore.getState().essentialsModeEnabled;
      setFocusMode(defaultFocus);
      return () => {
        setFocusMode(defaultFocus);
        setHintOpen(false);
      };
    }, [])
  );

  // These derived views used to recompute on EVERY render (each is a full-array filter/
  // sort; computeListGroups also groups by dish). Memoise them on the store state they read
  // — `tasksForDate`/`completedCount`/`currentList` are stable store fn refs, so `tasks` /
  // `shoppingLists` / `shoppingItems` are the real inputs that should drive recompute.
  const todayTasks = useMemo(() => tasksForDate(today), [tasksForDate, today, tasks]);
  const visibleTasks = useMemo(
    () => (focusMode ? todayTasks.filter((task) => task.importance === 'essential') : todayTasks),
    [focusMode, todayTasks]
  );

  const completedCount = useMemo(() => completedCountFn(), [completedCountFn, tasks]);

  // currentList is a fn ref; `shoppingLists` is the real input, so memo on it (this also
  // replaces the old `void shoppingLists` render-subscription hack).
  const currentShoppingList = useMemo(
    () => currentListFn(today),
    [currentListFn, today, shoppingLists]
  );
  const { dishGroups, ungroupedUnchecked, checked } = useMemo(
    () =>
      currentShoppingList
        ? computeListGroups(shoppingItems, currentShoppingList.id)
        : { dishGroups: [], ungroupedUnchecked: [], checked: [] },
    [currentShoppingList, shoppingItems]
  );

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
  const handleToggleShopping = useCallback((id: string) => toggleShoppingItem(id), [toggleShoppingItem]);
  const handleCollectShopping = useCallback((id: string) => toggleShoppingCollected(id), [toggleShoppingCollected]);
  const handleIncrementShopping = useCallback((id: string) => adjustAmount(id, 1), [adjustAmount]);
  const handleDecrementShopping = useCallback((id: string) => adjustAmount(id, -1), [adjustAmount]);
  const handleNavigateToShopping = useCallback(
    () => goToSite(router, pathname, '/shopping'),
    [router, pathname]
  );

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
        focusActive={focusMode}
        onToggleFocus={() => setFocusMode((v) => !v)}
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
        onScroll={handleScreenScroll}
      >
        <View style={styles.content}>
          {!focusMode && (
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
          )}

          {/* Greeting */}
          <DebugNoteAnchor id="home.greeting" label="Home — Greeting">
            <View style={styles.header}>
              <Text style={[styles.greeting, { color: theme.text }]}>
                {greeting()}{userName ? `, ${userName}` : ''}!
              </Text>
              <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{dateLabel}</Text>
            </View>
          </DebugNoteAnchor>

          {/* Notes preview — HomeNotesCard (real Notes / useNotesStore). Always visible. */}
          <DebugNoteAnchor id="home.notesPreview" label="Home — Notes preview" style={styles.section}>
            <HomeNotesCard />
          </DebugNoteAnchor>

          {/* Shared preview — HomeSharedCard (incoming shared tasks + shopping). Self-hides
              when nothing is incoming — gated here too (not just inside HomeSharedCard) so no
              empty `section`-margin wrapper is mounted in that case (see hasIncomingShared
              above). Hidden in Focus mode (an input/triage surface). */}
          {!focusMode && hasIncomingShared && (
            <DebugNoteAnchor id="home.sharedPreview" label="Home — Shared preview" style={styles.section}>
              <HomeSharedCard />
            </DebugNoteAnchor>
          )}

          {/* Plans preview = the shared PlanTaskCard day-view (Decision 009a). */}
          <DebugNoteAnchor id="home.plansPreview" label="Home — Plans preview" style={styles.section}>
            {focusMode ? (
              <PlanTaskCard
                tasks={visibleTasks}
                allTasks={tasks}
                onToggleTask={handleToggleTask}
                horizontal={planTimelineHorizontal}
              />
            ) : (
              <PlanTaskCard
                tasks={todayTasks}
                allTasks={tasks}
                readOnly
                onToggleTask={handleToggleTask}
                horizontal={planTimelineHorizontal}
              />
            )}
          </DebugNoteAnchor>

          {/* Shopping preview — HomeShoppingCard. Always visible. */}
          <DebugNoteAnchor id="home.shoppingPreview" label="Home — Shopping preview" style={styles.section}>
            <HomeShoppingCard
              list={currentShoppingList}
              dishGroups={dishGroups}
              ungroupedUnchecked={ungroupedUnchecked}
              checked={checked}
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

          {/* Gentle points */}
          {!focusMode && completedCount > 0 && (
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
  header: { marginBottom: Spacing.sm },
  // Home's big "Hei, Name" greeting — the screen's title role (2026-07-18: was xxl/semibold,
  // now Type.title for the refreshed hierarchy).
  greeting: { fontFamily: Type.title.fontFamily, fontSize: Type.title.size, lineHeight: Math.round(Type.title.size * Type.title.line) },
  dateLabel: { fontSize: FontSize.sm, marginTop: Spacing.xs, textTransform: 'capitalize', fontFamily: Fonts.regular },
  section: { marginTop: Spacing.xl },
  pointsText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
