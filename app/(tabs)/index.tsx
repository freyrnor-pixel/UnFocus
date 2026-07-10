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
 *             components/HomeSharedCard, components/HomeShoppingCard, components/AddFAB,
 *             constants/theme, lib/db, lib/date, lib/i18n, lib/siteNav, lib/shoppingGroups,
 *             lib/useAppTheme, store/useTaskStore, store/useNotesStore, store/useSharedStore,
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
 *     ON: hides the Notes + Shopping previews + points + FAB (no input affordances), leaving only
 *     the Plans surface filtered to `importance === 'essential'` (Decision 018 — the two-value
 *     `importance` field IS the intensity model; no energy path). The done-toggle stays live in
 *     focus (completing a task is "doing the thing", not input), so PlanTaskCard is mounted
 *     non-readOnly but WITHOUT `onPressTask`/`onSeeMore` — the row done-dot works, tap-through to
 *     the editor does not. Completing the last essential task → PlanTaskCard's own gentle
 *     `dayViewAllDone` state (Decision 009 #4 "gentle done-state, not an empty screen").
 *   - **Plans preview = PlanTaskCard read-only (Decision 009a)**: OFF-focus, the preview IS the
 *     day-view rendered read-only, with a "See everything →" link to /plans. Not a bespoke card.
 *     `allTasks` (full store) is passed so Decision 020 cross-date followers surface.
 *     `horizontal={settings.planTimelineHorizontal}` is threaded to both PlanTaskCard mounts
 *     (Focus + preview) so the rail-orientation setting applies in both modes.
 *   - **Notes preview = HomeNotesCard**: reads useNotesStore, shows first 3 active notes with
 *     inline toggle-checked, quick-add (→ /notes), and "See all →" link. Self-hides when empty.
 *   - **Shopping preview = HomeShoppingCard**: shows first 4 items flat when collapsed; full
 *     nested dish-group ExpandableCard structure when expanded. Reorder intentionally omitted
 *     (Decision 011 R1). Tick-to-buy, cart-collect, stepper, and catalog-vs-adhoc remove preserved.
 *   - **Deliberately NOT ported**: DayTimeline/TaskItem/NextTaskCard Plans stack, Backlog + Habits
 *     previews, SharedRequestsSection(kind='task'), update-ready banner, work-mode banner,
 *     CoverScreen / SiteSwipeView chrome, automation trigger ('shopping_opened').
 *   - **"More" links (Decision 036)**: off-Focus chips to /notes and /meals. Reachability is
 *     data-independent — shown even if HomeNotesCard self-hides (notes empty on first launch).
 *   - All visible strings via useT(); today is todayStr() (YYYY-MM-DD).
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import PlanTaskCard from '@/components/PlanTaskCard';
import HomeNotesCard from '@/components/HomeNotesCard';
import HomeSharedCard from '@/components/HomeSharedCard';
import HomeShoppingCard from '@/components/HomeShoppingCard';
import AddFAB from '@/components/AddFAB';
import HintCard from '@/components/HintCard';
import { goToSite } from '@/lib/siteNav';
import { todayStr } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { computeListGroups } from '@/lib/shoppingGroups';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useSharedStore } from '@/store/useSharedStore';
import { ShoppingItem, useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const today = todayStr();

  // Focus mode: Home-only, ephemeral (Decisions 009 #4 / 018). Reset on blur below.
  const [focusMode, setFocusMode] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

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

  const settings = useSettingsStore();

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

  const todayTasks = tasksForDate(today);
  const visibleTasks = focusMode
    ? todayTasks.filter((task) => task.importance === 'essential')
    : todayTasks;

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
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
      >
        <View style={styles.content}>
          {!focusMode && <HintCard text={t.hints.home.text} open={hintOpen} noPill />}

          {/* Greeting */}
          <View style={styles.header}>
            <Text style={[styles.greeting, { color: theme.text }]}>
              {greeting()}{settings.userName ? `, ${settings.userName}` : ''}!
            </Text>
            <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{dateLabel}</Text>
          </View>

          {/* Notes preview — HomeNotesCard (real Notes / useNotesStore). Always visible. */}
          <View style={styles.section}>
            <HomeNotesCard />
          </View>

          {/* Shared preview — HomeSharedCard (incoming shared tasks + shopping). Self-hides
              when nothing is incoming. Hidden in Focus mode (an input/triage surface). */}
          {!focusMode && (
            <View style={styles.section}>
              <HomeSharedCard />
            </View>
          )}

          {/* Plans preview = the shared PlanTaskCard day-view (Decision 009a). */}
          <View style={styles.section}>
            {focusMode ? (
              <PlanTaskCard
                tasks={visibleTasks}
                allTasks={tasks}
                onToggleTask={(task: Task) => toggleTask(task.id)}
                horizontal={settings.planTimelineHorizontal}
              />
            ) : (
              <PlanTaskCard
                tasks={todayTasks}
                allTasks={tasks}
                readOnly
                horizontal={settings.planTimelineHorizontal}
              />
            )}
          </View>

          {/* Shopping preview — HomeShoppingCard. Always visible. */}
          <View style={styles.section}>
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
              onNavigateToShopping={() => goToSite(router, pathname, '/shopping')}
              inStockLabel={t.inStockLabel}
            />
          </View>

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
  section: { marginBottom: Spacing.lg },
  pointsText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
