/**
 * index.tsx — Home screen (the daily landing hub).
 *
 * The app's calm daily overview: a low-weight greeting, then the three converged
 * previews (Decision 009 #2) — Notes (InboxSection), Plans (the shared PlanTaskCard
 * day-view), and Shopping (current week's list, ShoppingRow family on ExpandableCard) —
 * plus gentle completed-count points. Mounts via ScreenScaffold (Decision 001): the
 * scaffold owns the background, particles, header chrome (Settings gear + Focus eye),
 * and BottomNav; this screen only supplies content and wires Focus mode.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/PlanTaskCard, components/InboxSection,
 *             components/ExpandableCard, components/ShoppingRow, components/AddFAB, components/HintCard,
 *             constants/theme, lib/db, lib/date, lib/i18n, lib/siteNav, lib/shoppingGroups,
 *             lib/useAppTheme, store/useTaskStore, store/useShoppingStore, store/useShoppingListStore,
 *             store/useSettingsStore
 *   Used by → Expo Router route "/" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads useTaskStore (tasks) + useShoppingStore (items) + useShoppingListStore
 *             (currentList(today)); mutates via toggle / toggleCheck / toggleCollected /
 *             adjustAmount / putBackToInventory / removeWithSource. Settings via useSettingsStore.
 *
 * Edit notes:
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
 *     `allTasks` (full store) is passed so Decision 020 cross-date followers surface (the
 *     surfacing itself lives inside PlanTaskCard; this screen only feeds it the data).
 *   - **Notes preview = InboxSection (Decision 009 #2)**: self-contained (reads its own store),
 *     renders nothing when the inbox is empty; the separate old useNotesStore Home preview is
 *     folded away by the convergence (Notes preview → InboxSection).
 *   - **Shopping preview**: the current week's list only (useShoppingListStore.currentList), its
 *     rows converged onto ExpandableCard + ShoppingRow (Decision 009 #2 / Session A). Reorder is
 *     intentionally omitted here — drag-reorder needs the parent screen's hit-testing (Decision
 *     011 R1), which is app/shopping.tsx's job, not a lightweight Home preview's. Tick-to-buy,
 *     cart-collect, stepper, and catalog-vs-adhoc remove are all preserved.
 *   - **Deliberately NOT ported (deps superseded or absent — flagged, not silently dropped):**
 *     the old two-section DayTimeline/TaskItem/NextTaskCard Plans stack (superseded by
 *     PlanTaskCard per 009a); the Backlog + Habits previews (both rendered via `TaskItem`, which
 *     is not ported to this repo); the separate Notes(useNotesStore) preview (folded into
 *     InboxSection by 009 #2); SharedRequestsSection(kind='task') (the ported component supports
 *     only kind='shopping'); the update-ready banner (useUpdateStore not ported); the work-mode
 *     banner (lib/holidays / rankTodayTasks not ported); CoverScreen / SiteSwipeView chrome.
 *   - **Scope item 4 — automation trigger ('shopping_opened') NOT wired: no automation store
 *     exists in this repo** (useAutomationStore / lib automations were never ported — see
 *     useTaskStore's own header flag for the sibling 'task_completed' gap). Wiring it now would
 *     mean building an automation system from scratch (unrecorded), so it is flagged for the
 *     notifications/automation port, not invented here.
 *   - **"More" links (Decision 036)**: a small always-visible (off-Focus) row of chips
 *     linking to the off-nav sites Notes (/notes) and Food (/meals), which have no BottomNav
 *     tab. Without these, both screens were unreachable. Automations gets its entry from
 *     Settings, not here. Reachability is data-independent (shown even when those screens are
 *     empty), unlike the InboxSection preview which self-hides when the inbox is empty.
 *   - All visible strings via useT(); today is todayStr() (YYYY-MM-DD).
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import PlanTaskCard from '@/components/PlanTaskCard';
import InboxSection from '@/components/InboxSection';
import ExpandableCard from '@/components/ExpandableCard';
import ShoppingRow from '@/components/ShoppingRow';
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
    }, [loadSettings, loadTasks, loadShopping, loadLists])
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
  const shoppingItemCount =
    dishGroups.reduce((n, [, g]) => n + g.length, 0) + ungroupedUnchecked.length + checked.length;

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

  const renderShoppingRow = (item: ShoppingItem, idx: number, total: number, variant: 'planned' | 'cart') => (
    <View key={item.id}>
      <ShoppingRow
        item={item}
        variant={variant}
        onToggle={() => toggleShoppingItem(item.id)}
        onCollect={variant === 'cart' ? () => toggleShoppingCollected(item.id) : undefined}
        onRemove={() => handleRemoveShoppingItem(item)}
        onIncrement={() => adjustAmount(item.id, 1)}
        onDecrement={() => adjustAmount(item.id, -1)}
        inStockLabel={t.inStockLabel}
      />
      {idx < total - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.surfaceMuted }]} />}
    </View>
  );

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

          {/* Notes preview (Decision 009 #2 — InboxSection). Hidden in Focus mode. */}
          {!focusMode && <InboxSection />}

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

          {/* Shopping preview (Decision 009 #2 — current week's list). Hidden in Focus mode. */}
          {!focusMode && (
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
                <ExpandableCard
                  title={currentShoppingList.name}
                  badge={shoppingItemCount > 0 ? String(shoppingItemCount) : undefined}
                  accentColor={theme.featShop}
                  defaultOpen={false}
                >
                  {dishGroups.map(([dishName, groupItems]) => (
                    <ExpandableCard
                      key={dishName}
                      title={dishName}
                      subtitle={t.ingredientsCount(groupItems.length)}
                      accentColor={theme.featShop}
                      defaultOpen={false}
                    >
                      {groupItems.map((item, idx) => renderShoppingRow(item, idx, groupItems.length, 'planned'))}
                    </ExpandableCard>
                  ))}

                  {ungroupedUnchecked.length > 0 && (
                    <View style={styles.shoppingSection}>
                      <Text style={[styles.sectionLabel, { color: theme.featShop }]}>{t.inWeeklyListSection}</Text>
                      {ungroupedUnchecked.map((item, idx) => renderShoppingRow(item, idx, ungroupedUnchecked.length, 'planned'))}
                    </View>
                  )}

                  {checked.length > 0 && (
                    <View style={styles.shoppingSection}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.inKurvenSection(checked.length)}</Text>
                      {checked.map((item, idx) => renderShoppingRow(item, idx, checked.length, 'cart'))}
                    </View>
                  )}

                  {shoppingItemCount === 0 && (
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.shoppingEmpty}</Text>
                  )}
                </ExpandableCard>
              )}
            </View>
          )}

          {/* More — entry points for the off-nav sites (Decision 036: Notes + Food
              are reachable but not BottomNav tabs). Always shown off-Focus so these
              screens have a discoverable home no matter what data exists. */}
          {!focusMode && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.home.more}</Text>
              <View style={styles.moreLinks}>
                <Pressable
                  style={[styles.moreChip, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => goToSite(router, pathname, '/notes')}
                  hitSlop={6}
                >
                  <Text style={[styles.moreChipText, { color: theme.text }]}>{t.notes.title}</Text>
                </Pressable>
                <Pressable
                  style={[styles.moreChip, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => goToSite(router, pathname, '/meals')}
                  hitSlop={6}
                >
                  <Text style={[styles.moreChipText, { color: theme.text }]}>{t.nav.meals}</Text>
                </Pressable>
              </View>
            </View>
          )}

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
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.xs },
  shoppingSection: { gap: Spacing.xs, marginTop: Spacing.sm },
  rowDivider: { height: 1 },
  moreLinks: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap' },
  moreChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  moreChipText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  emptyText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.sm },
  pointsText: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
