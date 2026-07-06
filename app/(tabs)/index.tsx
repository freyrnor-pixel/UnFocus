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
 *             components/HomeShoppingCard, components/AddFAB, components/HintCard,
 *             constants/theme, lib/db, lib/date, lib/i18n, lib/siteNav, lib/shoppingGroups,
 *             lib/useAppTheme, store/useTaskStore, store/useNotesStore, store/useShoppingStore,
 *             store/useShoppingListStore, store/useSettingsStore
 *   Used by → Expo Router route "/" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads useTaskStore (tasks) + useNotesStore (notes) + useShoppingStore (items) +
 *             useShoppingListStore (currentList(today)); mutates via toggle / toggleCheck /
 *             toggleCollected / adjustAmount / putBackToInventory / removeWithSource.
 *             Settings via useSettingsStore.
 *
 * Edit notes:
 *   - **Focus mode (Decisions 009 #4 / 018)**: Home-only, session-ephemeral local state. Its
 *     DEFAULT is seeded from the persisted `essentialsModeEnabled` "Focus mode" setting on every
 *     focus-in, and leaving the screen resets it back to that default (not a hardcoded OFF) — so
 *     the settings toggle (previously inert) and the header eye are ONE feature: a saved default
 *     plus a live session toggle, not two unrelated things that happened to share the name "Focus".
 *     The header eye toggles it (props threaded through ScreenScaffold → ScreenHeader).
 *     ON: hides the points + FAB (no input affordances); Notes and Shopping previews remain visible.
 *     Plans surface is filtered to `importance === 'essential'` (Decision 018 — the two-value
 *     `importance` field IS the intensity model; no energy path). The done-toggle stays live in
 *     focus (completing a task is "doing the thing", not input), so PlanTaskCard is mounted
 *     non-readOnly but WITHOUT `onPressTask`/`onSeeMore` — the row done-dot works, tap-through to
 *     the editor does not. Completing the last essential task → PlanTaskCard's own gentle
 *     `dayViewAllDone` state (Decision 009 #4 "gentle done-state, not an empty screen").
 *   - **Plans preview = PlanTaskCard read-only (Decision 009a)**: OFF-focus, the preview IS the
 *     day-view rendered read-only, with a "See everything →" link to /plans. Not a bespoke card.
 *     `allTasks` (full store) is passed so Decision 020 cross-date followers surface.
 *   - **Notes preview = HomeNotesCard**: reads useNotesStore, shows first 3 active notes with
 *     inline toggle-checked, quick-add (→ /notes), and "See all →" link. Self-hides when empty.
 *   - **Shopping preview = HomeShoppingCard**: shows first 4 items flat when collapsed; full
 *     nested dish-group ExpandableCard structure when expanded. Reorder intentionally omitted
 *     (Decision 011 R1). Tick-to-buy, cart-collect, stepper, and catalog-vs-adhoc remove preserved.
 *   - **Deliberately NOT ported**: DayTimeline/TaskItem/NextTaskCard Plans stack, Backlog + Habits
 *     previews, SharedRequestsSection(kind='task'), update-ready banner, work-mode banner,
 *     CoverScreen / SiteSwipeView chrome, automation trigger ('shopping_opened').
 *   - **"More" links (Decision 036)**: removed. Notes/Food chips dropped; all three preview
 *     cards (Notes, Plans, Shopping) are now always visible regardless of Focus mode.
 *   - All visible strings via useT(); today is todayStr() (YYYY-MM-DD).
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import PlanTaskCard from '@/components/PlanTaskCard';
import HomeNotesCard from '@/components/HomeNotesCard';
import HomeShoppingCard from '@/components/HomeShoppingCard';
import AddFAB from '@/components/AddFAB';
import HintCard from '@/components/HintCard';
import { goToSite } from '@/lib/siteNav';
import { initDb } from '@/lib/db';
import { todayStr } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { computeListGroups } from '@/lib/shoppingGroups';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { useNotesStore } from '@/store/useNotesStore';
import { ShoppingItem, useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useSettingsStore } from '@/store/useSettingsStore';

let dbBootstrapped = false;

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const today = todayStr();

  // Focus mode: Home-only, ephemeral (Decisions 009 #4 / 018). Reset on blur below.
  const [focusMode, setFocusMode] = useState(false);

  const tasks = useTaskStore((s) => s.tasks);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const toggleTask = useTaskStore((s) => s.toggle);
  const completedCountFn = useTaskStore((s) => s.completedCount);
  const loadTasks = useTaskStore((s) => s.load);

  const loadNotes = useNotesStore((s) => s.load);

  const shoppingItems = useShoppingStore((s) => s.items);
  const toggleShoppingItem = useShoppingStore((s) => s.toggleCheck);
  const toggleShoppingCollected = useShoppingStore((s) => s.toggleCollected);
  const putBackToInventory = useShoppingStore((s) => s.putBackToInventory);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const adjustAmount = useShoppingStore((s) => s.adjustAmount);
  const loadShopping = useShoppingStore((s) => s.load);

  const shoppingLists = useShoppingListStore((s) => s.lists);
  const currentListFn = useShoppingListStore((s) => s.currentList);
  const loadLists = useShoppingListStore((s) => s.load);

  const settings = useSettingsStore();
  const loadSettings = useSettingsStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadTasks();
      loadNotes();
      loadShopping();
      loadLists();
      // Focus mode's default is the persisted "Focus mode" setting
      // (essentialsModeEnabled). The header eye still toggles it live for the
      // session; leaving Home resets it back to that default. This keeps the
      // toggle ephemeral within a session (Decision 009 #4) while making the
      // settings toggle — which was otherwise inert — the source of the default,
      // so the two "Focus mode" surfaces are one coherent feature, not two.
      const defaultFocus = useSettingsStore.getState().essentialsModeEnabled;
      setFocusMode(defaultFocus);
      return () => setFocusMode(defaultFocus);
    }, [loadSettings, loadTasks, loadNotes, loadShopping, loadLists])
  );

  const todayTasks = tasksForDate(today);
  const visibleTasks = focusMode
    ? todayTasks.filter((task) => task.importance === 'essential')
    : todayTasks;

  const totalToday = todayTasks.length;
  const completedToday = todayTasks.filter((task) => task.done).length;
  const progressRatio = totalToday > 0 ? completedToday / totalToday : 0;
  const completedCount = completedCountFn();

  const currentShoppingList = currentListFn(today);
  // Read `shoppingLists` so this render subscribes to list changes (currentList is a fn ref).
  void shoppingLists;
  const { dishGroups, ungroupedUnchecked, checked } = currentShoppingList
    ? computeListGroups(shoppingItems, currentShoppingList.id)
    : { dishGroups: [], ungroupedUnchecked: [], checked: [] };
  if (!settings.loaded || !settings.setupComplete) {
    return <View style={[styles.blank, { backgroundColor: theme.bg }]} />;
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 10) return t.greeting.morning;
    if (h < 17) return t.greeting.day;
    return t.greeting.evening;
  };
  const now = new Date();
  const dateLabel = `${t.days[now.getDay()]} ${now.getDate()}. ${t.months[now.getMonth()]}`;

  function handleRemoveShoppingItem(item: ShoppingItem) {
    if (item.fromCatalog) {
      putBackToInventory(item.id);
    } else {
      removeWithSource(item.id);
    }
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
      >
        <View style={styles.content}>
          {/* Focus-mode hint — the header eye is a non-obvious affordance, so it
              qualifies for a HintCard under Decision 030's "demonstrated need"
              bar. Gated on showHints + hidden in Focus itself. */}
          {!focusMode && <HintCard text={t.hints.home.text} />}

          {/* Greeting */}
          <View style={styles.header}>
            <Text style={[styles.greeting, { color: theme.text }]}>
              {greeting()}{settings.userName ? `, ${settings.userName}` : ''}!
            </Text>
            <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{dateLabel}</Text>
          </View>

          {/* Daily progress line */}
          {totalToday > 0 && (
            <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.good, width: `${Math.round(progressRatio * 100)}%` }]} />
            </View>
          )}

          {/* Notes preview — HomeNotesCard (real Notes / useNotesStore). Always visible. */}
          <HomeNotesCard />

          {/* Plans preview = the shared PlanTaskCard day-view (Decision 009a). */}
          <View style={styles.section}>
            {focusMode ? (
              <PlanTaskCard
                tasks={visibleTasks}
                allTasks={tasks}
                onToggleTask={(task: Task) => toggleTask(task.id)}
              />
            ) : (
              <PlanTaskCard
                tasks={todayTasks}
                allTasks={tasks}
                readOnly
                onSeeMore={() => goToSite(router, pathname, '/plans')}
              />
            )}
          </View>

          {/* Shopping preview — HomeShoppingCard. Always visible. */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.shoppingPreview}</Text>
              <Pressable onPress={() => goToSite(router, pathname, '/shopping')} hitSlop={8}>
                <Text style={[styles.seeAll, { color: theme.accent }]}>{t.seeAll}</Text>
              </Pressable>
            </View>
            {!currentShoppingList ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.shoppingEmpty}</Text>
            ) : (
              <HomeShoppingCard
                list={currentShoppingList}
                dishGroups={dishGroups}
                ungroupedUnchecked={ungroupedUnchecked}
                checked={checked}
                onToggle={(id) => toggleShoppingItem(id)}
                onCollect={(id) => toggleShoppingCollected(id)}
                onRemove={handleRemoveShoppingItem}
                onIncrement={(id) => adjustAmount(id, 1)}
                onDecrement={(id) => adjustAmount(id, -1)}
                onSeeAll={() => goToSite(router, pathname, '/shopping')}
                inStockLabel={t.inStockLabel}
              />
            )}
          </View>

          {/* Gentle points */}
          {!focusMode && settings.showPoints && completedCount > 0 && (
            <View style={styles.section}>
              <Text style={[styles.pointsText, { color: theme.textMuted }]}>
                {t.smallThingsCount(completedCount)}
              </Text>
            </View>
          )}
        </View>
      </ScreenScaffold>

      {/* Add a task — a Home input affordance, so hidden in Focus mode (Decision 009 #4). */}
      {!focusMode && <AddFAB onPress={() => router.push('/task-form')} accessibilityLabel={t.newTask} />}
    </>
  );
}

const baseStyles = StyleSheet.create({
  blank: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  header: { marginBottom: Spacing.lg },
  greeting: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold },
  dateLabel: { fontSize: FontSize.sm, marginTop: Spacing.xs, textTransform: 'capitalize', fontFamily: Fonts.regular },
  progressTrack: { height: 4, borderRadius: Radius.full, marginBottom: Spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  seeAll: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  emptyText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.sm },
  pointsText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
