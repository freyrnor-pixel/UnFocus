/**
 * shopping.tsx — Weekly shopping lists & Monthly catalog, Decision 011 target layout.
 *
 * Tabbed shopping screen. The "Week lists" tab renders one WeekListCard per
 * non-template shopping_lists row plus an empty "create new list" card. The
 * "Monthly list" tab is a single lock-gated catalog card (staging tray,
 * dish-grouped + ungrouped items, purchased-this-month history). A
 * screen-level sticky bar (Decision 011 A2-1) sits under the standard header
 * and never scrolls away — it holds the tab switcher, the focused weekly
 * list's summary/progress (or the catalog's staged count), and an overflow
 * menu for the monthly reset action (A2-4).
 *
 * Connections:
 *   Imports → components/AddDishSheet, components/AddDivider, components/AddItemSheet,
 *             components/AddSourceChooser, components/AppModal (showAppModal),
 *             components/ConfirmationBanner, components/DraggableTaskRow,
 *             components/ExpandableCard, components/HintCard, components/IconButton,
 *             components/ListSettingsSheet, components/MonthlyResetSummaryModal,
 *             components/MonthlyTableRow, components/ProgressBar, components/SavedListsModal,
 *             components/ScreenScaffold, components/SharedRequestsSection,
 *             components/ShoppingRow, components/Surface, components/UpdateSheet,
 *             components/WeekListCard, constants/theme,
 *             lib/date (todayStr, dateStr, getWeekRangeContaining), lib/haptics (success,
 *             heavy, warning), lib/i18n, lib/shoppingGroups (groupByDish, computeListGroups,
 *             listProgress), lib/useAppTheme, store/useMealStore, store/useSettingsStore,
 *             store/useShoppingListStore, store/useShoppingStore
 *   Used by → Expo Router route "/shopping"
 *   Data    → useShoppingStore (items/trips) + useShoppingListStore (lists, incl. each
 *             list's locked/isTemplate state) + useSettingsStore (monthlyResetDate) +
 *             useMealStore (dishes, read-only, dish-group price lookup)
 *
 * Edit notes:
 *   - New file (2026-07-02, Session A2·2). app/shopping.tsx never existed in this repo
 *     before this session — this is a from-scratch build against Decision 011 (A2-1,
 *     A2-4) and Decision 017, using the old repo's app/shopping.tsx only as a reference
 *     for behavior/copy, not a line-for-line port. See PROGRESS_LOG for the full scope
 *     trail (this session expanded well past its original "re-layout an existing file"
 *     brief once it turned out the file, WeekListCard, and three Phase-3e components
 *     didn't exist yet).
 *   - **A2-1 sticky bar**: uses ScreenScaffold's new `stickyBelowHeader` slot (added this
 *     session). Surface `surfaceContext="overlay"` per Surface.tsx's own docstring, which
 *     names "sticky headers... nav bar" as the overlay use case — `ScreenHeader`/`BottomNav`
 *     still use the ambient default; flagged as a doc-vs-source inconsistency in
 *     PROGRESS_LOG, not fixed here (out of scope, those are shared foundation files).
 *     `STICKY_HEIGHT` is a fixed estimate (tab row + summary row), not measured — good
 *     enough for a stub-data screen with no live-app verification available.
 *   - **A2-1 focused list**: `focusedListId` picks which non-template list's summary the
 *     sticky bar shows (Decision 017 Q3/Q4 — focused-list-only, never an aggregate).
 *     Falls back to the first list when nothing is explicitly focused yet or the focused
 *     list was deleted. WeekListCard's own compact progress line (non-focused lists only)
 *     calls `onFocus` to switch it — see WeekListCard.tsx's header note.
 *   - **A2-4 body order**: HintCard (inline, first scroll item, not pinned) →
 *     SharedRequestsSection → per-list WeekListCards (each carrying its own collapsed
 *     "Bought this week" history — see WeekListCard.tsx) → "create new list" card. Monthly
 *     reset is a manual action in the sticky bar's overflow menu, not an automatic
 *     mount-time effect — see the store-stub note below.
 *   - **Decision 011 R1 reorder wiring**: this screen owns row-layout collection
 *     (`rowLayouts` ref, keyed `listId:itemId`), hit-testing (`computeTargetIndex`), live
 *     preview reflow (`LayoutAnimation.configureNext` on every reorder-preview change,
 *     same idiom ExpandableCard.tsx already uses), and persistence (`reorderItem` called
 *     once per index step crossed between drag-start and drag-end, via
 *     useShoppingStore.reorder's existing 'up'/'down' stub shape). Only the "Shopping
 *     list" (ungrouped-unchecked) section is reorderable — dish-group and bought-history
 *     rows never had move affordances either, in the old app or here. The hit-test
 *     snapshot is captured once at drag-start from each row's last-measured layout; it
 *     does not re-measure mid-drag, so it's an approximation, not pixel-perfect —
 *     reasonable for a first cut given no live-app verification is available this session.
 *   - **Store stubs are Phase 5 (Decision 015) — every action throws.** This screen never
 *     calls a store action from a mount-time effect (unlike the old app's
 *     advanceRecurringLists/load()/automatic payday-boundary monthly-reset detection,
 *     none of which are wired here — flagged as a Phase 5 follow-up in PROGRESS_LOG, not
 *     silently dropped). Every action call site here is a user-triggered handler
 *     (onPress/onSubmitEditing/drag-end), the same accepted-safe pattern every other
 *     already-shipped sheet in this repo already uses.
 *   - **Dropped from the old screen, flagged not silently absorbed**: the header's Share
 *     pill (site-tier ScreenHeader has no custom-right slot — only sub-tier does); the
 *     'shopping_opened' automation trigger (useAutomationStore doesn't exist in this repo);
 *     SiteSwipeView's swipe-between-screens wrapper (Phase 3e, not ported, not required by
 *     A2-1/A2-4); routing to /scan from "Shopping done!"'s receipt choice (app/scan.tsx
 *     doesn't exist yet — Scan/Upload/Skip all just call doneShopping() for now).
 *   - `ConfirmationBanner` renders as a sibling of `<ScreenScaffold>`, not inside its
 *     children — ScreenScaffold's children render inside its internal ScrollView, and
 *     ConfirmationBanner is a plain absolutely-positioned overlay (not a `<Modal>` like
 *     the sheets below it), so nesting it in scrollable content would make it scroll
 *     away instead of staying fixed near the top of the screen.
 *   - Monthly/Katalog tab is a light, functional but NOT redesigned port (Decision 011
 *     A2-3: "Monthly stays... untouched by A2-2"; A2-1/A2-4 only target the weekly tab
 *     per Decision 011's own grounding note) — Surface replaces the old Container, but
 *     the section order/behavior is otherwise unchanged from the old app.
 *   - Decision 011a/R4 dish-checkbox wiring (2026-07-02, Phase 4): this session flagged
 *     dish groups as "read-only... no parent/child checkbox binding attempted." Closed
 *     now — toggleDish() here is the bulk roll-up/roll-down action R4 calls for, reusing
 *     the existing per-item toggleCheck (no new store action); WeekListCard's dish-group
 *     ExpandableCard calls it via the new onToggleDish prop. Required loosening
 *     computeListGroups()'s dish grouping to include checked items too (previously
 *     unchecked-only, which made the "dish shows checked" roll-up unobservable) — see
 *     lib/shoppingGroups.ts's own header note.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useShoppingStore, ShoppingItem, MonthlyResetSummary } from '@/store/useShoppingStore';
import { useShoppingListStore, ShoppingList } from '@/store/useShoppingListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useMealStore } from '@/store/useMealStore';
import ShoppingRow from '@/components/ShoppingRow';
import MonthlyTableRow from '@/components/MonthlyTableRow';
import AddItemSheet from '@/components/AddItemSheet';
import AddSourceChooser from '@/components/AddSourceChooser';
import UpdateSheet from '@/components/UpdateSheet';
import MonthlyResetSummaryModal from '@/components/MonthlyResetSummaryModal';
import SharedRequestsSection from '@/components/SharedRequestsSection';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import { showAppModal } from '@/components/AppModal';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import AddDivider from '@/components/AddDivider';
import ExpandableCard from '@/components/ExpandableCard';
import AddDishSheet from '@/components/AddDishSheet';
import WeekListCard from '@/components/WeekListCard';
import SavedListsModal from '@/components/SavedListsModal';
import ListSettingsSheet from '@/components/ListSettingsSheet';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import HintCard from '@/components/HintCard';
import IconButton from '@/components/IconButton';
import ProgressBar from '@/components/ProgressBar';
import { success, heavy, warning } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr, getWeekRangeContaining } from '@/lib/date';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { groupByDish, computeListGroups, listProgress } from '@/lib/shoppingGroups';

type Tab = 'weekly' | 'catalog';

/** What a tapped inline "+" should add to: a specific Week list, or the Monthly catalog. */
type AddItemTarget = { origin: 'weekly'; listId: string } | { origin: 'catalog' };

const STICKY_HEIGHT = 116;

type DragState = {
  listId: string;
  itemId: string;
  startOrder: string[];
  order: string[];
  snapshot: Record<string, { y: number; height: number }>;
};

/** Insertion index for `centerY` against a snapshot of each row's last-measured layout. */
function computeTargetIndex(centerY: number, order: string[], snapshot: Record<string, { y: number; height: number }>): number {
  for (let i = 0; i < order.length; i++) {
    const layout = snapshot[order[i]];
    if (!layout) continue;
    const rowCenter = layout.y + layout.height / 2;
    if (centerY < rowCenter) return i;
  }
  return order.length - 1;
}

export default function ShoppingScreen() {
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();

  const [tab, setTab] = useState<Tab>('weekly');
  const [focusedListId, setFocusedListId] = useState<string | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<AddItemTarget | null>(null);
  const [addSourceChooserListId, setAddSourceChooserListId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [purchasedExpanded, setPurchasedExpanded] = useState<string | null>(null);
  const [resetSummary, setResetSummary] = useState<MonthlyResetSummary | null>(null);
  const [savedListsListId, setSavedListsListId] = useState<string | null>(null);
  const [listSettingsListId, setListSettingsListId] = useState<string | null>(null);
  const [catalogLocked, setCatalogLocked] = useState(true);
  const [updateItem, setUpdateItem] = useState<ShoppingItem | null>(null);
  const [addDishSheetOpen, setAddDishSheetOpen] = useState(false);

  const [drag, setDrag] = useState<DragState | null>(null);
  const rowLayouts = useRef<Map<string, { y: number; height: number }>>(new Map());

  const items = useShoppingStore((s) => s.items);
  const trips = useShoppingStore((s) => s.trips);
  const add = useShoppingStore((s) => s.add);
  const update = useShoppingStore((s) => s.update);
  const toggle = useShoppingStore((s) => s.toggleCheck);
  const toggleCollected = useShoppingStore((s) => s.toggleCollected);
  /** Decision 011a/R4: bulk roll-up/roll-down for a dish group's checkbox — checks every
   *  unchecked ingredient if not all are checked yet, unchecks every ingredient if all are
   *  (011a decision #1/#3, no separate un-check case). Reuses the existing per-item
   *  `toggleCheck` path rather than a new store action. */
  const toggleDish = useCallback(
    (dishItems: ShoppingItem[]) => {
      const target = !dishItems.every((i) => i.checked);
      dishItems.forEach((i) => {
        if (i.checked !== target) toggle(i.id);
      });
    },
    [toggle]
  );
  const addToWeeklyFromCatalog = useShoppingStore((s) => s.addToWeeklyFromCatalog);
  const putBackToInventory = useShoppingStore((s) => s.putBackToInventory);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const adjustAmount = useShoppingStore((s) => s.adjustAmount);
  const setPendingRestock = useShoppingStore((s) => s.setPendingRestock);
  const confirmStagingTray = useShoppingStore((s) => s.confirmStagingTray);
  const doneShopping = useShoppingStore((s) => s.doneShopping);
  const monthlyReset = useShoppingStore((s) => s.monthlyReset);
  const buildMonthlyResetSummary = useShoppingStore((s) => s.buildMonthlyResetSummary);
  const reorderItem = useShoppingStore((s) => s.reorder);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
  const weeklyResetDay = useSettingsStore((s) => s.weeklyResetDay);
  const dishes = useMealStore((s) => s.dishes);

  const lists = useShoppingListStore((s) => s.lists);
  const renameList = useShoppingListStore((s) => s.rename);
  const toggleListLocked = useShoppingListStore((s) => s.toggleLocked);
  const setListRecurring = useShoppingListStore((s) => s.setRecurring);
  const saveListAsTemplate = useShoppingListStore((s) => s.saveAsTemplate);
  const instantiateTemplate = useShoppingListStore((s) => s.instantiateTemplate);
  const addList = useShoppingListStore((s) => s.add);
  const removeList = useShoppingListStore((s) => s.remove);

  const nonTemplateLists = useMemo(() => lists.filter((l) => !l.isTemplate), [lists]);
  const templateLists = useMemo(() => lists.filter((l) => l.isTemplate), [lists]);
  const focusedList = useMemo(
    () => nonTemplateLists.find((l) => l.id === focusedListId) ?? nonTemplateLists[0],
    [nonTemplateLists, focusedListId]
  );

  // Close both add sheets on every focus transition — mirrors the old app's rationale:
  // the receipt pop-up's Scan/Upload choices would otherwise leave a sheet open behind
  // whatever screen it pushed to. No /scan push exists yet, but the reset-on-blur is
  // still correct behavior for any other bypass of the normal close path.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setAddItemTarget(null);
        setAddSourceChooserListId(null);
      };
    }, [])
  );

  const catalogItems = useMemo(
    () => items.filter((i) => i.status === 'catalog').sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  const stagedItems = useMemo(() => catalogItems.filter((i) => i.pendingRestock), [catalogItems]);
  const restItems = useMemo(() => catalogItems.filter((i) => !i.pendingRestock), [catalogItems]);
  const { dishGroups: catalogDishGroups, ungrouped: ungroupedRestItems } = useMemo(
    () => groupByDish(restItems),
    [restItems]
  );

  const purchasedByTrip = useMemo(() => {
    const purchased = items.filter((i) => i.status === 'purchased' && i.shoppingTripId);
    return trips
      .map((trip) => ({ trip, tripItems: purchased.filter((i) => i.shoppingTripId === trip.id) }))
      .filter((g) => g.tripItems.length > 0);
  }, [items, trips]);

  const katalogBadge = stagedItems.length;
  const ukelisteBadge = useMemo(
    () => items.filter((i) => i.status === 'inWeeklyList' && !i.checked && nonTemplateLists.some((l) => l.id === i.listId)).length,
    [items, nonTemplateLists]
  );
  const unlockedListCount = useMemo(() => nonTemplateLists.filter((l) => !l.locked).length, [nonTemplateLists]);

  const focusedGroups = useMemo(
    () => (focusedList ? computeListGroups(items, focusedList.id) : null),
    [items, focusedList]
  );
  const focusedProgress = useMemo(() => (focusedGroups ? listProgress(focusedGroups) : null), [focusedGroups]);

  function handleConfirmTray() {
    if (stagedItems.length === 0) return;
    confirmStagingTray();
    success();
    setConfirm(t.confirmStagingBtn(stagedItems.length));
  }

  // Weekly/cart rows that came from the Monthly list go back to inventory instead of
  // being deleted outright (their single row IS the standing catalog entry).
  function handleRemoveWeeklyItem(item: ShoppingItem) {
    if (item.fromCatalog) {
      putBackToInventory(item.id);
      success();
      setConfirm(t.itemPutBackToInventory(item.name));
    } else {
      removeWithSource(item.id);
    }
  }

  function handleDoneShopping(list: ShoppingList, checkedCount: number) {
    if (checkedCount === 0) return;
    const label = t.tripLabel(dateStr(new Date()));
    // Scan/Upload both just commit the trip for now — app/scan.tsx isn't ported yet
    // (out of scope this session), so there's nowhere to route to.
    showAppModal(t.doneShoppingReceiptTitle, t.doneShoppingReceiptBody, [
      { text: t.scanReceiptBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); heavy(); setConfirm(t.doneShoppingSuccessText); } },
      { text: t.uploadPhotoBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); heavy(); setConfirm(t.doneShoppingSuccessText); } },
      { text: t.skipBtn, style: 'cancel', onPress: () => { doneShopping(list.id, label, monthlyResetDate); heavy(); setConfirm(t.doneShoppingSuccessText); } },
    ]);
  }

  function handleAddItem(input: { name: string; price: number; targetQuantity: number; isTemporary: boolean; alsoAddToCatalog: boolean }) {
    if (!addItemTarget) return;
    if (addItemTarget.origin === 'catalog') {
      add({ name: input.name, amount: '1', unit: '', listType: 'monthly', store: '', price: input.price, inventoryQty: 0, isTemporary: input.isTemporary, targetQuantity: input.targetQuantity, status: 'catalog' });
    } else {
      add({ name: input.name, amount: '1', unit: '', listType: 'weekly', store: '', price: input.price, inventoryQty: 0, isTemporary: input.isTemporary, targetQuantity: input.targetQuantity, status: 'inWeeklyList', listId: addItemTarget.listId });
      if (input.alsoAddToCatalog) {
        add({ name: input.name, amount: '1', unit: '', listType: 'monthly', store: '', price: input.price, inventoryQty: 0, isTemporary: input.isTemporary, targetQuantity: input.targetQuantity, status: 'catalog' });
      }
    }
    const origin = addItemTarget.origin;
    setAddItemTarget(null);
    success();
    setConfirm(origin === 'catalog' ? t.itemAddedToInventory(input.name) : t.itemAddedToList(input.name));
  }

  function handleUpdateSave(patch: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) {
    if (!updateItem) return;
    update(updateItem.id, patch);
    setUpdateItem(null);
    success();
  }

  function handleUpdateDelete() {
    if (!updateItem) return;
    removeWithSource(updateItem.id);
    setUpdateItem(null);
    heavy();
  }

  function handleSaveDish(input: { dishName: string; ingredients: { name: string; amount: string; unit: string; price: number }[] }) {
    for (const ing of input.ingredients) {
      add({ name: ing.name, amount: ing.amount, unit: ing.unit, listType: 'monthly', store: '', price: ing.price, inventoryQty: 0, status: 'catalog', dishName: input.dishName });
    }
    setAddDishSheetOpen(false);
    success();
    setConfirm(t.itemAddedToInventory(input.dishName));
  }

  function handleCreateNewWeeklyList() {
    const { startDate, endDate } = getWeekRangeContaining(todayStr(), weeklyResetDay);
    addList({ startDate, endDate });
    success();
  }

  function handleDeleteList(listId: string) {
    warning();
    showAppModal(t.deleteListConfirmTitle, t.deleteListConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteList, style: 'destructive', onPress: () => removeList(listId) },
    ]);
  }

  function handleManualMonthlyReset() {
    warning();
    showAppModal(t.resetMonthlyListConfirmTitle, t.resetMonthlyListConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.resetMonthlyListAction,
        style: 'destructive',
        onPress: () => {
          setResetSummary(buildMonthlyResetSummary());
          monthlyReset();
        },
      },
    ]);
  }

  function handleOpenOverflow() {
    showAppModal(t.moreOptions, undefined, [
      { text: t.resetMonthlyListAction, onPress: handleManualMonthlyReset },
      { text: t.cancel, style: 'cancel' },
    ]);
  }

  // ── Decision 011 R1: reorder wiring (screen-owned hit-testing/live-reflow/persistence) ──

  function handleRowLayout(listId: string, itemId: string, layout: { y: number; height: number }) {
    rowLayouts.current.set(`${listId}:${itemId}`, layout);
  }

  function handleDragStart(listId: string, itemId: string, order: string[]) {
    const snapshot: Record<string, { y: number; height: number }> = {};
    for (const id of order) {
      const l = rowLayouts.current.get(`${listId}:${id}`);
      if (l) snapshot[id] = l;
    }
    setDrag({ listId, itemId, startOrder: order, order, snapshot });
  }

  function handleDragMove(listId: string, itemId: string, centerY: number) {
    setDrag((prev) => {
      if (!prev || prev.listId !== listId || prev.itemId !== itemId) return prev;
      const targetIndex = computeTargetIndex(centerY, prev.order, prev.snapshot);
      const currentIndex = prev.order.indexOf(itemId);
      if (targetIndex === currentIndex) return prev;
      const nextOrder = [...prev.order];
      nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, itemId);
      if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return { ...prev, order: nextOrder };
    });
  }

  function handleDragEnd(listId: string, itemId: string) {
    setDrag((prev) => {
      if (prev && prev.listId === listId && prev.itemId === itemId) {
        const fromIndex = prev.startOrder.indexOf(itemId);
        const toIndex = prev.order.indexOf(itemId);
        const delta = toIndex - fromIndex;
        if (delta !== 0) {
          const direction: 'up' | 'down' = delta > 0 ? 'down' : 'up';
          for (let i = 0; i < Math.abs(delta); i++) reorderItem(itemId, direction);
        }
      }
      return null;
    });
  }

  const stickyBelowHeader = (
    <Surface surfaceContext="overlay" style={styles.stickyBar}>
      <View style={styles.tabsRow}>
        {(['weekly', 'catalog'] as Tab[]).map((tabOption) => {
          const isActive = tab === tabOption;
          const accent = tabOption === 'weekly' ? theme.good : theme.accent;
          const count = tabOption === 'weekly' ? ukelisteBadge : katalogBadge;
          return (
            <Pressable
              key={tabOption}
              style={[styles.tab, isActive && { borderBottomColor: accent, borderBottomWidth: 2 }]}
              onPress={() => setTab(tabOption)}
            >
              <Text style={[styles.tabText, { color: isActive ? accent : theme.textMuted }]}>
                {tabOption === 'weekly' ? t.weeklyTabLabel : t.monthlyTabLabel}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? accent : theme.surfaceMuted }]}>
                  <Text style={[styles.tabBadgeText, { color: isActive ? theme.accentInk : theme.textMuted }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        <IconButton icon="ellipsis-horizontal" label={t.moreOptions} onPress={handleOpenOverflow} size={30} />
      </View>

      {tab === 'weekly' && focusedList && focusedProgress ? (
        <View style={styles.stickySummaryRow}>
          <Text style={[styles.stickyListName, { color: theme.text }]} numberOfLines={1}>{focusedList.name}</Text>
          <Text style={[styles.stickyProgressText, { color: theme.textMuted }]}>
            {t.shoppingRemaining(focusedProgress.remaining, focusedProgress.inCart)}
          </Text>
          <ProgressBar value={focusedProgress.pct} state="good" height={6} style={styles.stickyProgressBar} />
        </View>
      ) : tab === 'catalog' ? (
        <View style={styles.stickySummaryRow}>
          <Text style={[styles.stickyListName, { color: theme.text }]} numberOfLines={1}>{t.monthlyTabLabel}</Text>
          {katalogBadge > 0 && (
            <Text style={[styles.stickyProgressText, { color: theme.textMuted }]}>{t.stagingTrayHeader(katalogBadge)}</Text>
          )}
        </View>
      ) : null}
    </Surface>
  );

  return (
    <>
    <ScreenScaffold title={t.shoppingTitle} tier="site" stickyBelowHeader={stickyBelowHeader} stickyBelowHeaderHeight={STICKY_HEIGHT}>
      <View style={styles.content}>
        <HintCard text={t.hints.shopping.text} example={t.hints.shopping.example} />

        <SharedRequestsSection kind="shopping" />

        {tab === 'catalog' && (
          <Surface style={styles.catalogCard}>
            <View style={styles.catalogHeaderRow}>
              <Text style={[styles.catalogTitle, { color: theme.text }]}>{t.monthlyTabLabel}</Text>
              <IconButton
                icon={catalogLocked ? 'lock-closed' : 'lock-open-outline'}
                label={catalogLocked ? t.unlockListButtonLabel : t.lockListButtonLabel}
                onPress={() => setCatalogLocked((v) => !v)}
                active={catalogLocked}
              />
            </View>

            <View style={styles.bodyGap}>
              {stagedItems.length > 0 && (
                <View style={[styles.trayCard, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
                  <Text style={[styles.trayHeader, { color: theme.accent }]}>{t.stagingTrayHeader(stagedItems.length)}</Text>
                  {stagedItems.map((item) => (
                    <View key={item.id} style={styles.trayRow}>
                      <Text style={[styles.trayItemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                      <Pressable onPress={() => setPendingRestock(item.id, false)} hitSlop={6}>
                        <Text style={{ color: theme.textMuted, fontSize: FontSize.md }}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable style={[styles.trayConfirmBtn, { backgroundColor: theme.accent }]} onPress={handleConfirmTray}>
                    <Text style={[styles.trayConfirmText, { color: theme.accentInk }]}>{t.confirmStagingBtn(stagedItems.length)}</Text>
                  </Pressable>
                </View>
              )}

              {catalogItems.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionLabel, { color: theme.accent }]}>{t.catalogHeader(catalogItems.length)}</Text>
                    <View style={[styles.sectionRule, { backgroundColor: theme.accent }]} />
                  </View>
                  {catalogDishGroups.length > 0 && (
                    <View style={styles.dishGroupsWrap}>
                      {catalogDishGroups.map(([dishName, groupItems]) => (
                        <ExpandableCard key={dishName} title={dishName} subtitle={t.ingredientsCount(groupItems.length)} accentColor={theme.accent} defaultOpen={false}>
                          {groupItems.map((item, idx) => (
                            <View key={item.id}>
                              <MonthlyTableRow
                                item={item}
                                onTogglePending={() => setPendingRestock(item.id, !item.pendingRestock)}
                                onPress={!catalogLocked ? () => setUpdateItem(item) : undefined}
                                temporaryLabel={t.temporaryBadge}
                              />
                              {idx < groupItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                            </View>
                          ))}
                        </ExpandableCard>
                      ))}
                    </View>
                  )}
                  <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                    {ungroupedRestItems.map((item, idx) => (
                      <View key={item.id}>
                        <MonthlyTableRow
                          item={item}
                          onTogglePending={() => setPendingRestock(item.id, !item.pendingRestock)}
                          onPress={!catalogLocked ? () => setUpdateItem(item) : undefined}
                          temporaryLabel={t.temporaryBadge}
                        />
                        {idx < ungroupedRestItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                      </View>
                    ))}
                  </View>
                  <AddDivider onPress={() => setAddItemTarget({ origin: 'catalog' })} disabled={catalogLocked} />
                  <AddDivider onPress={() => setAddDishSheetOpen(true)} disabled={catalogLocked} />
                </View>
              )}

              {purchasedByTrip.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.purchasedThisMonthSection}</Text>
                  {purchasedByTrip.map(({ trip, tripItems }) => {
                    const expanded = purchasedExpanded === trip.id;
                    return (
                      <View key={trip.id}>
                        <Pressable style={styles.sectionHeaderRow} onPress={() => setPurchasedExpanded(expanded ? null : trip.id)}>
                          <Text style={[styles.weekLabel, { color: theme.textMuted }]}>{trip.label}</Text>
                          <Text style={[styles.disclosureChevron, { color: theme.textMuted }]}>{expanded ? '▲' : '▼'}</Text>
                        </Pressable>
                        {expanded && (
                          <Surface style={styles.rowsCard}>
                            {tripItems.map((item, idx) => (
                              <View key={item.id}>
                                <ShoppingRow item={item} variant="purchased" onToggle={() => {}} onRemove={() => removeWithSource(item.id)} />
                                {idx < tripItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                              </View>
                            ))}
                          </Surface>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </Surface>
        )}

        {tab === 'weekly' && (
          <>
            {unlockedListCount > 0 && (
              <View style={[styles.unsavedBanner, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.unsavedBannerText, { color: theme.accent }]}>{t.unsavedShoppingBanner(unlockedListCount)}</Text>
              </View>
            )}

            {nonTemplateLists.map((list) => {
              const groups = computeListGroups(items, list.id);
              const groupsProgress = listProgress(groups);
              const order = groups.ungroupedUnchecked.map((i) => i.id);
              const displayUngrouped =
                drag && drag.listId === list.id
                  ? (drag.order.map((id) => groups.ungroupedUnchecked.find((i) => i.id === id)).filter(Boolean) as ShoppingItem[])
                  : groups.ungroupedUnchecked;

              return (
                <WeekListCard
                  key={list.id}
                  list={list}
                  focused={focusedList?.id === list.id}
                  onFocus={() => setFocusedListId(list.id)}
                  dishGroups={groups.dishGroups}
                  dishes={dishes}
                  ungroupedUnchecked={displayUngrouped}
                  checked={groups.checked}
                  onToggleLock={() => toggleListLocked(list.id)}
                  onRename={(name) => renameList(list.id, name)}
                  onOpenSavedLists={() => setSavedListsListId(list.id)}
                  onOpenListSettings={() => setListSettingsListId(list.id)}
                  onDelete={() => handleDeleteList(list.id)}
                  onToggleItem={(item) => toggle(item.id)}
                  onToggleDish={toggleDish}
                  onCollectItem={(item) => toggleCollected(item.id)}
                  onRemoveItem={handleRemoveWeeklyItem}
                  onIncrementItem={(item) => adjustAmount(item.id, 1)}
                  onDecrementItem={(item) => adjustAmount(item.id, -1)}
                  onAddPress={() => setAddSourceChooserListId(list.id)}
                  onDoneShopping={() => handleDoneShopping(list, groupsProgress.inCart)}
                  renderReorderableRow={(item) => (
                    <DraggableTaskRow
                      isOpen={false}
                      onRowLayout={(layout) => handleRowLayout(list.id, item.id, layout)}
                      onDragStart={() => handleDragStart(list.id, item.id, order)}
                      onDragMove={(centerY) => handleDragMove(list.id, item.id, centerY)}
                      onDragEnd={() => handleDragEnd(list.id, item.id)}
                    >
                      <ShoppingRow
                        item={item}
                        variant="planned"
                        onToggle={() => toggle(item.id)}
                        onRemove={() => handleRemoveWeeklyItem(item)}
                        onIncrement={() => adjustAmount(item.id, 1)}
                        onDecrement={() => adjustAmount(item.id, -1)}
                        inStockLabel={t.inStockLabel}
                        locked={list.locked}
                      />
                    </DraggableTaskRow>
                  )}
                />
              );
            })}

            <Pressable
              style={[styles.newListCard, { borderColor: theme.border }]}
              onPress={() =>
                showAppModal(t.newWeeklyListTitle, '', [
                  { text: t.startEmptyList, onPress: handleCreateNewWeeklyList },
                  { text: t.savedListsTitle, onPress: () => setSavedListsListId('__new__') },
                  { text: t.cancel, style: 'cancel' },
                ])
              }
            >
              <Text style={[styles.newListPlus, { color: theme.textMuted }]}>+</Text>
              <Text style={[styles.newListText, { color: theme.textMuted }]}>{t.newWeeklyListTitle}</Text>
            </Pressable>
          </>
        )}
      </View>

      <AddItemSheet
        visible={addItemTarget !== null}
        origin={addItemTarget?.origin ?? 'weekly'}
        onClose={() => setAddItemTarget(null)}
        onAdd={handleAddItem}
      />

      <AddSourceChooser
        visible={addSourceChooserListId !== null}
        catalogItems={catalogItems}
        onClose={() => setAddSourceChooserListId(null)}
        onConfirmInventoryPicks={(picks) => {
          if (!addSourceChooserListId) return;
          const pickNames = picks.map((p) => items.find((i) => i.id === p.id)?.name);
          for (const pick of picks) addToWeeklyFromCatalog(pick.id, pick.quantity, addSourceChooserListId);
          success();
          if (picks.length === 1 && pickNames[0]) setConfirm(t.itemAddedToList(pickNames[0]));
          else if (picks.length > 1) setConfirm(t.itemsAddedToList(picks.length));
        }}
        onOpenAddSheet={() => {
          if (addSourceChooserListId) setAddItemTarget({ origin: 'weekly', listId: addSourceChooserListId });
        }}
      />

      <UpdateSheet visible={updateItem !== null} item={updateItem} onClose={() => setUpdateItem(null)} onSave={handleUpdateSave} onDelete={handleUpdateDelete} />

      <MonthlyResetSummaryModal visible={resetSummary !== null} summary={resetSummary} onClose={() => setResetSummary(null)} />

      <AddDishSheet visible={addDishSheetOpen} onClose={() => setAddDishSheetOpen(false)} onSave={handleSaveDish} />

      <SavedListsModal
        visible={savedListsListId !== null}
        templates={templateLists}
        onClose={() => setSavedListsListId(null)}
        onSelectTemplate={(id) => {
          const newId = instantiateTemplate(id, todayStr());
          if (newId) {
            success();
            setConfirm(t.templateAppliedToast);
          }
        }}
        onSaveCurrentAsTemplate={() => {
          if (!savedListsListId) return;
          saveListAsTemplate(savedListsListId);
          success();
          setConfirm(t.listSavedAsTemplateToast);
        }}
      />

      <ListSettingsSheet
        visible={listSettingsListId !== null}
        list={nonTemplateLists.find((l) => l.id === listSettingsListId)}
        onClose={() => setListSettingsListId(null)}
        onSetRecurring={(isRecurring, intervalWeeks) => {
          if (listSettingsListId) setListRecurring(listSettingsListId, isRecurring, intervalWeeks);
        }}
      />
    </ScreenScaffold>
    <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  bodyGap: { gap: Spacing.md },
  dishGroupsWrap: { gap: Spacing.xs },

  stickyBar: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.xs, gap: 2 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  tabBadge: { minWidth: 18, height: 18, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontFamily: Fonts.bold },
  stickySummaryRow: { gap: 4, paddingBottom: Spacing.xs },
  stickyListName: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  stickyProgressText: { fontSize: FontSize.xs },
  stickyProgressBar: { marginTop: 2 },

  catalogCard: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catalogTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold },

  unsavedBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.md, padding: Spacing.sm },
  unsavedBannerText: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },

  trayCard: { borderRadius: Radius.md, borderWidth: 2, padding: Spacing.md, gap: Spacing.xs },
  trayHeader: { fontSize: FontSize.sm, fontFamily: Fonts.bold, marginBottom: Spacing.xs },
  trayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  trayItemName: { flex: 1, fontSize: FontSize.sm },
  trayConfirmBtn: { borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm, minHeight: 44, justifyContent: 'center' },
  trayConfirmText: { fontFamily: Fonts.bold, fontSize: FontSize.sm },

  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  rowDivider: { height: 1 },
  section: { gap: Spacing.xs },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  sectionRule: { flex: 1, height: 2, borderRadius: Radius.full, opacity: 0.4 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

  disclosureChevron: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  weekLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

  newListCard: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', gap: 4 },
  newListPlus: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  newListText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
