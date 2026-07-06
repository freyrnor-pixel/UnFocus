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
 *   Imports → components/AddDivider, components/AddItemSheet, components/HintCard,
 *             components/AddSourceChooser, components/AppModal (showAppModal),
 *             components/ConfirmationBanner, components/DraggableTaskRow,
 *             components/ExpandableCard, components/IconButton,
 *             components/ListSettingsSheet, components/MonthlyResetSummaryModal,
 *             components/MonthlyTableRow, components/ProgressBar, components/SavedListsModal,
 *             components/ScreenScaffold, components/SharedRequestsSection,
 *             components/ShoppingRow, components/Surface, components/UpdateSheet,
 *             components/WeekListCard, constants/theme,
 *             lib/date (todayStr, dateStr, getWeekRangeContaining), lib/haptics (success,
 *             heavy, warning), lib/i18n, lib/shoppingGroups (groupByDish, computeListGroups,
 *             listProgress), lib/useAppTheme, store/useCatalogStore,
 *             store/useSettingsStore, store/useShoppingListStore, store/useShoppingStore,
 *             @expo/vector-icons (Ionicons)
 *   Used by → Expo Router route "/shopping" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → useShoppingStore (items/trips) + useShoppingListStore (lists, incl. each
 *             list's locked/isTemplate state) + useSettingsStore (monthlyResetDate) +
 *             useCatalogStore
 *             (loaded on focus; its seed items back the Monthly "Catalogue" section here,
 *             the WeekListCard inline search, and the create-grouping screen)
 *
 * Edit notes:
 *   - **Shopping redesign (2026-07-06)**: the Monthly/catalog tab is now TWO sections —
 *     "Monthly list" (the status:'catalog' items the user has curated, dish-grouped +
 *     ungrouped, each with an inline qty stepper + remove ×, plus a running total) and
 *     "Catalogue" (the full seed catalog from useCatalogStore, searchable; tap "+" to add a
 *     seed item to the Monthly list, or a stepper when it's already there). Dish creation
 *     is no longer an in-tab button/modal — it moved to its own screen, app/create-grouping.tsx,
 *     reached by the floating "Create grouping" FAB rendered on BOTH tabs (bottom-right,
 *     above BottomNav). AddDishSheet is no longer used by this screen. The weekly WeekListCard
 *     gained an inline catalogue search, an "add from monthly list" preview, and a running
 *     total (see WeekListCard.tsx). List recurrence is now "active weeks of the month" (1–4,
 *     multi-select) via ListSettingsSheet → setActiveWeeks.
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
 *   - **A2-4 body order**: SharedRequestsSection →
 *     per-list WeekListCards (each carrying its own collapsed
 *     "Bought this week" history — see WeekListCard.tsx) → "create new list" card. Monthly
 *     reset is a manual action in the sticky bar's overflow menu, not an automatic
 *     mount-time effect — see the store-stub note below.
 *   - **Decision 011 R1 reorder + Decision 022 drag-to-merge wiring** (window-coordinate,
 *     2026-07-03): this screen owns hit-testing/live-reflow/persistence for both. Native
 *     nodes are registered up from DraggableTaskRow (each ungrouped reorder row, via
 *     `registerNode`) and WeekListCard (each "From meals" dish-group card, via
 *     `registerDishGroupNode`), keyed `listId:itemId` / `listId:dishName`. At drag-start
 *     they're measured with `measureInWindow` into `dragSnapshotRef` / `dishRectsRef` — a
 *     shared **window** space, the only frame where the ungrouped section and the dish
 *     cards (different parents) are comparable. The dragged row measures ITSELF inside
 *     DraggableTaskRow and reports live window centerY. On move: if that centerY falls in a
 *     dish-group band → mark it the merge/join target (WeekListCard highlights it via
 *     `mergeHighlightDish`); otherwise run the R1 reorder preview (`computeTargetIndex` +
 *     `LayoutAnimation`). On drop over a dish (Decision 022): a same-name ingredient in that
 *     dish → `mergeItems` (sum + adopt dishName, drop the standalone row); no same-name →
 *     `update(dishName)` so the item joins THIS dish instance (never edits the dish's base
 *     recipe — that's managed elsewhere; per the 2026-07-03 design answer). Reorder persists
 *     via `reorderItem` 'up'/'down' as before. Only the ungrouped section is reorderable;
 *     dish/bought rows still have no move affordance. `dragRef` mirrors `drag` state so the
 *     drop handler reads the final drag synchronously. measureInWindow snapshots are taken
 *     once at drag-start (no mid-drag re-measure) — an approximation, no live-app verification
 *     this session. Decision 022's ephemeral *undo* affordance is deferred (a transient
 *     ConfirmationBanner confirms the merge for now — see PROGRESS_LOG 2026-07-03).
 *   - **Mount-time store hydration (Phase 5, 2026-07-02):** the on-focus effect now
 *     initialises the DB (idempotent, once per app session via the module-level
 *     `dbBootstrapped` guard — the app still has no global bootstrap; _layout is the
 *     Phase 1 scaffold), hydrates the settings/shopping/list stores, runs
 *     advanceRecurringLists(today) (re-loading shopping items after, since it writes
 *     shopping_items rows directly), and performs the automatic payday-boundary
 *     monthly-reset detection (buildMonthlyResetSummary BEFORE monthlyReset, then
 *     persists lastMonthlyReset). This replaces the earlier stub-era note that said no
 *     store action is called from a mount-time effect — useShoppingStore /
 *     useShoppingListStore are now real Phase-5 stores, not throwing Decision 015 stubs.
 *   - The 'shopping_opened' automation trigger fires once per mount (useAutomationStore is
 *     now ported — Phase 6); the mount effect self-loads rules + guards initDb first.
 *     "Shopping done!"'s Scan/Upload choices now route to /scan (autoCapture camera/library);
 *     Skip commits the trip in place (app/scan.tsx is now ported — Phase 6).
 *   - **Still dropped, flagged not silently absorbed**: the header's Share pill (site-tier
 *     ScreenHeader has no custom-right slot — only sub-tier does); SiteSwipeView's
 *     swipe-between-screens wrapper (Phase 3e, not ported, not required by A2-1/A2-4).
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShoppingStore, ShoppingItem, MonthlyResetSummary } from '@/store/useShoppingStore';
import { useShoppingListStore, ShoppingList } from '@/store/useShoppingListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useAutomationStore } from '@/store/useAutomationStore';
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
import WeekListCard from '@/components/WeekListCard';
import SavedListsModal from '@/components/SavedListsModal';
import ListSettingsSheet from '@/components/ListSettingsSheet';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import IconButton from '@/components/IconButton';
import ProgressBar from '@/components/ProgressBar';
import HintCard from '@/components/HintCard';
import { success, heavy, warning } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr, getWeekRangeContaining } from '@/lib/date';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { groupByDish, computeListGroups, listProgress } from '@/lib/shoppingGroups';
import { formatKr } from '@/lib/money';
import { initDb } from '@/lib/db';

type Tab = 'weekly' | 'catalog';

/**
 * One-time-per-app-session DB init guard. The app has no global bootstrap yet
 * (_layout.tsx is still the Phase 1 scaffold), so the first screen that needs
 * persistence initialises the schema. initDb() is idempotent, but this avoids
 * re-running the full CREATE/migrate pass on every screen focus.
 */
let dbBootstrapped = false;

/**
 * Decision 029 — catalog lock persistence. The Monthly catalog's lock is a
 * session-scoped convenience lock (distinct from week-list locks, which are
 * per-row persisted in `shopping_lists.locked`). Holding it at module level lets
 * it survive in-session navigation away from and back to this screen, while a
 * fresh module evaluation on cold start re-locks it. Deliberately NOT a SQLite
 * column — persisting it would wrongly survive an app restart, contradicting
 * "re-lock on launch."
 */
let catalogLockedSession = true;

/** What a tapped inline "+" should add to: a specific Week list, or the Monthly catalog. */
type AddItemTarget = { origin: 'weekly'; listId: string } | { origin: 'catalog' };

const STICKY_HEIGHT = 116;

type DragState = {
  listId: string;
  itemId: string;
  /** Cached at drag-start so the drop handler can match a same-name dish ingredient. */
  itemName: string;
  startOrder: string[];
  order: string[];
  /** Decision 022: dish group currently under the dragged row (valid merge/join target), or null. */
  mergeTargetDish: string | null;
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
  const router = useRouter();
  const { reducedMotion } = useAccessibility();

  // Fire the 'shopping_opened' automation trigger once per screen visit (mount).
  // Ensure the DB is open and rules are loaded first so fireTrigger sees them
  // (there's no global bootstrap yet — same self-load precedent as the focus effect).
  useEffect(() => {
    if (!dbBootstrapped) {
      initDb();
      dbBootstrapped = true;
    }
    const auto = useAutomationStore.getState();
    auto.load();
    auto.fireTrigger('shopping_opened');
  }, []);

  const [tab, setTab] = useState<Tab>('weekly');
  const [hintOpen, setHintOpen] = useState(false);
  const [focusedListId, setFocusedListId] = useState<string | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<AddItemTarget | null>(null);
  const [addSourceChooserListId, setAddSourceChooserListId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [purchasedExpanded, setPurchasedExpanded] = useState<string | null>(null);
  const [resetSummary, setResetSummary] = useState<MonthlyResetSummary | null>(null);
  const [savedListsListId, setSavedListsListId] = useState<string | null>(null);
  const [listSettingsListId, setListSettingsListId] = useState<string | null>(null);
  // Decision 029: seed from the module-level session flag so the lock state survives
  // navigating away and back; the setter mirrors every change back to it so it outlives
  // this screen's mount but not the process (cold start re-evaluates the module → locked).
  const [catalogLocked, setCatalogLockedState] = useState(catalogLockedSession);
  const setCatalogLocked = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setCatalogLockedState((prev) => {
      const resolved = typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next;
      catalogLockedSession = resolved;
      return resolved;
    });
  }, []);
  const [updateItem, setUpdateItem] = useState<ShoppingItem | null>(null);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);

  // ── Decision 011 R1 reorder + Decision 022 drag-to-merge (all window-coordinate based) ──
  // Native nodes are registered by DraggableTaskRow (reorder rows) and WeekListCard (dish-group
  // cards) so this screen can measureInWindow() them at drag-start into a shared window space —
  // the only space where the ungrouped section and the "From meals" dish cards are comparable.
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rowNodes = useRef<Map<string, any>>(new Map());
  const dishNodes = useRef<Map<string, any>>(new Map());
  const dragSnapshotRef = useRef<Record<string, { y: number; height: number }>>({});
  const dishRectsRef = useRef<Record<string, { y: number; height: number }>>({});
  const setDragState = useCallback(
    (next: DragState | null | ((prev: DragState | null) => DragState | null)) => {
      setDrag((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: DragState | null) => DragState | null)(prev) : next;
        dragRef.current = resolved;
        return resolved;
      });
    },
    []
  );

  const items = useShoppingStore((s) => s.items);
  const trips = useShoppingStore((s) => s.trips);
  const add = useShoppingStore((s) => s.add);
  const update = useShoppingStore((s) => s.update);
  const toggle = useShoppingStore((s) => s.toggleCheck);
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
  const mergeItems = useShoppingStore((s) => s.mergeItems);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
  const weeklyResetDay = useSettingsStore((s) => s.weeklyResetDay);
  const loadCatalog = useCatalogStore((s) => s.load);
  const seedCatalogItems = useCatalogStore((s) => s.items);
  const [catalogueSearch, setCatalogueSearch] = useState('');

  const lists = useShoppingListStore((s) => s.lists);
  const renameList = useShoppingListStore((s) => s.rename);
  const toggleListLocked = useShoppingListStore((s) => s.toggleLocked);
  const setListRecurring = useShoppingListStore((s) => s.setRecurring);
  const setListActiveWeeks = useShoppingListStore((s) => s.setActiveWeeks);
  const saveListAsTemplate = useShoppingListStore((s) => s.saveAsTemplate);
  const instantiateTemplate = useShoppingListStore((s) => s.instantiateTemplate);
  const addList = useShoppingListStore((s) => s.add);
  const removeList = useShoppingListStore((s) => s.remove);
  const advanceRecurringLists = useShoppingListStore((s) => s.advanceRecurringLists);
  const loadLists = useShoppingListStore((s) => s.load);
  const loadShopping = useShoppingStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const updateSettings = useSettingsStore((s) => s.update);

  const nonTemplateLists = useMemo(() => lists.filter((l) => !l.isTemplate), [lists]);
  const templateLists = useMemo(() => lists.filter((l) => l.isTemplate), [lists]);
  const focusedList = useMemo(
    () => nonTemplateLists.find((l) => l.id === focusedListId) ?? nonTemplateLists[0],
    [nonTemplateLists, focusedListId]
  );

  // Persistence bootstrap + mount-time store hydration (Phase 5). Runs on every
  // focus; also closes both add sheets on blur (mirrors the old app: the receipt
  // pop-up's Scan/Upload choices would otherwise leave a sheet open behind
  // whatever screen it pushed to — no /scan push exists yet, but the reset is
  // still correct for any other bypass of the normal close path).
  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      // Hydrate every store this screen reads. Settings first, since the list
      // store's default-name / week-range helpers read weeklyResetDay + language.
      loadSettings();
      loadShopping();
      loadLists();
      // The Catalogue section, the WeekListCard inline search, and the create-grouping
      // screen all read this store directly, so it must be populated on focus.
      loadCatalog();

      // Roll any overdue recurring list forward to the period containing today.
      // A no-op once every recurring list is already current, so it's safe to run
      // on every focus rather than gating it behind a once-per-period flag like
      // the monthly reset below. advanceRecurringLists() writes shopping_items
      // rows directly via the list store, so re-run the shopping load afterwards
      // to pick up any freshly copied rows.
      const today = todayStr();
      advanceRecurringLists(today);
      loadShopping();

      // Automatic payday-boundary reset: once per period, when today's day-of-month
      // has reached monthlyResetDate and we haven't already reset for this period.
      // Read settings via getState() (not the render-time selectors) so we see the
      // values loadSettings() just wrote this same tick. buildMonthlyResetSummary()
      // must run BEFORE monthlyReset() clears the purchased rows it reads.
      const periodKey = today.slice(0, 7); // YYYY-MM
      const settings = useSettingsStore.getState();
      const alreadyResetThisPeriod = settings.lastMonthlyReset.slice(0, 7) === periodKey;
      if (!alreadyResetThisPeriod && new Date().getDate() >= settings.monthlyResetDate) {
        setResetSummary(buildMonthlyResetSummary());
        monthlyReset();
        updateSettings({ lastMonthlyReset: today });
      }

      return () => {
        setAddItemTarget(null);
        setAddSourceChooserListId(null);
        setHintOpen(false);
      };
    }, [
      loadSettings,
      loadShopping,
      loadLists,
      loadCatalog,
      advanceRecurringLists,
      buildMonthlyResetSummary,
      monthlyReset,
      updateSettings,
    ])
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

  // Running total of the curated Monthly list (price × targetQuantity per row).
  const monthlyTotal = useMemo(
    () => catalogItems.reduce((sum, i) => sum + i.price * i.targetQuantity, 0),
    [catalogItems]
  );
  // Lowercased name → its Monthly-list row, so the Catalogue picker can show a stepper
  // for items already added and a "+" for the rest.
  const monthlyByName = useMemo(() => {
    const map = new Map<string, ShoppingItem>();
    for (const i of catalogItems) map.set(i.name.trim().toLowerCase(), i);
    return map;
  }, [catalogItems]);
  const filteredSeedCatalog = useMemo(() => {
    const q = catalogueSearch.trim().toLowerCase();
    const sorted = [...seedCatalogItems].sort((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter((i) => i.name.toLowerCase().includes(q)) : sorted;
  }, [seedCatalogItems, catalogueSearch]);

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

  const purchasedByListId = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of items.filter((i) => i.status === 'purchased')) {
      const key = item.listId ?? '';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [items]);
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
    // Scan/Upload commit the trip, then route to /scan with autoCapture so the scanner
    // opens the camera/library straight away (app/scan.tsx is now ported). Skip just
    // commits the trip and confirms in place.
    showAppModal(t.doneShoppingReceiptTitle, t.doneShoppingReceiptBody, [
      { text: t.scanReceiptBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); router.push({ pathname: '/scan', params: { autoCapture: 'camera' } }); } },
      { text: t.uploadPhotoBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); router.push({ pathname: '/scan', params: { autoCapture: 'library' } }); } },
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

  // ── Monthly two-section wiring (Phase 2) ──
  // Tapping a seed-catalogue item adds it to the Monthly list (status 'catalog'); add()'s
  // dedup bumps targetQuantity if it's already there, so repeated taps raise the quantity.
  function handleAddSeedToMonthly(seed: { name: string; price: number }) {
    add({ name: seed.name, amount: '1', unit: '', listType: 'monthly', store: '', price: seed.price, inventoryQty: 0, status: 'catalog', targetQuantity: 1 });
    success();
  }
  function handleMonthlyQty(item: ShoppingItem, delta: number) {
    const next = item.targetQuantity + delta;
    if (next <= 0) {
      removeWithSource(item.id);
    } else {
      update(item.id, { targetQuantity: next });
    }
  }

  const handleDecrementCartItem = useCallback(
    (item: ShoppingItem) => {
      const qty = parseInt(item.amount, 10) || 1;
      if (qty <= 1) {
        // Move item back to "In list" by unchecking it
        toggle(item.id);
        return;
      }
      // Reduce cart item qty by 1
      adjustAmount(item.id, -1);
      // Find or create an "In list" unchecked copy of this item and add 1 there
      const existing = items.find(
        (i) =>
          i.status === 'inWeeklyList' &&
          i.listId === item.listId &&
          !i.checked &&
          i.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      if (existing) {
        adjustAmount(existing.id, 1);
      } else {
        add({
          name: item.name,
          amount: '1',
          unit: item.unit ?? '',
          listType: 'weekly',
          store: item.store ?? '',
          price: item.price,
          inventoryQty: 0,
          status: 'inWeeklyList',
          listId: item.listId,
        });
      }
    },
    [items, toggle, adjustAmount, add]
  );

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
    setResetConfirmVisible(true);
  }

  function handleConfirmReset() {
    setResetConfirmVisible(false);
    setResetSummary(buildMonthlyResetSummary());
    monthlyReset();
  }

  // ── Decision 011 R1 reorder + Decision 022 drag-to-merge (screen-owned, window-coordinate) ──

  function handleRegisterRowNode(listId: string, itemId: string, node: any) {
    const key = `${listId}:${itemId}`;
    if (node) rowNodes.current.set(key, node);
    else rowNodes.current.delete(key);
  }

  function handleRegisterDishNode(listId: string, dishName: string, node: any) {
    const key = `${listId}:${dishName}`;
    if (node) dishNodes.current.set(key, node);
    else dishNodes.current.delete(key);
  }

  function handleDragStart(listId: string, itemId: string, itemName: string, order: string[]) {
    // Measure the sibling reorder rows + this list's dish-group cards in window space (the
    // dragged row measures itself inside DraggableTaskRow). measureInWindow's callbacks land
    // within a frame — before the first onDragMove, which only fires once the finger moves
    // past DraggableTaskRow's threshold — so the snapshots are ready by the time they're read.
    dragSnapshotRef.current = {};
    for (const id of order) {
      rowNodes.current.get(`${listId}:${id}`)?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        dragSnapshotRef.current[id] = { y, height: h };
      });
    }
    dishRectsRef.current = {};
    const prefix = `${listId}:`;
    for (const [key, node] of dishNodes.current.entries()) {
      if (!key.startsWith(prefix)) continue;
      const dishName = key.slice(prefix.length);
      node?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        dishRectsRef.current[dishName] = { y, height: h };
      });
    }
    setDragState({ listId, itemId, itemName, startOrder: order, order, mergeTargetDish: null });
  }

  function handleDragMove(listId: string, itemId: string, centerY: number) {
    setDragState((prev) => {
      if (!prev || prev.listId !== listId || prev.itemId !== itemId) return prev;
      // 1. Cross-section merge/join target: the dragged row's window centerY inside a dish band.
      //    Any dish group is a valid drop (same-name → merge, else → join this dish instance).
      let mergeTargetDish: string | null = null;
      for (const dishName in dishRectsRef.current) {
        const r = dishRectsRef.current[dishName];
        if (centerY >= r.y && centerY <= r.y + r.height) {
          mergeTargetDish = dishName;
          break;
        }
      }
      if (mergeTargetDish) {
        if (prev.mergeTargetDish === mergeTargetDish) return prev;
        if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        return { ...prev, mergeTargetDish };
      }
      // 2. Otherwise, in-section reorder preview (unchanged Decision 011 R1 behavior).
      const snapshot = dragSnapshotRef.current;
      const currentIndex = prev.order.indexOf(itemId);
      const targetIndex = Object.keys(snapshot).length ? computeTargetIndex(centerY, prev.order, snapshot) : currentIndex;
      let order = prev.order;
      if (targetIndex !== currentIndex && targetIndex >= 0) {
        order = [...prev.order];
        order.splice(currentIndex, 1);
        order.splice(targetIndex, 0, itemId);
        if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      if (order === prev.order && prev.mergeTargetDish === null) return prev;
      return { ...prev, order, mergeTargetDish: null };
    });
  }

  function handleDragEnd(listId: string, itemId: string) {
    const prev = dragRef.current;
    if (prev && prev.listId === listId && prev.itemId === itemId) {
      if (prev.mergeTargetDish) {
        // Decision 022: dropped onto a dish group. If that dish already holds a same-name
        // ingredient, merge (mergeItems sums amounts + keeps the dish's dishName, drops the
        // standalone row). Otherwise the item simply joins THIS instance of the dish (adopt
        // its dishName) — it never edits the dish's base recipe, which is managed elsewhere.
        const dish = prev.mergeTargetDish;
        const name = prev.itemName.trim().toLowerCase();
        const twin = items.find(
          (i) =>
            i.status === 'inWeeklyList' &&
            i.listId === listId &&
            i.dishName === dish &&
            i.id !== itemId &&
            i.name.trim().toLowerCase() === name
        );
        if (twin) {
          mergeItems(itemId, twin.id);
          setConfirm(t.mergedIntoDish(dish));
        } else {
          update(itemId, { dishName: dish });
          setConfirm(t.movedToDish(dish));
        }
        success();
      } else {
        const fromIndex = prev.startOrder.indexOf(itemId);
        const toIndex = prev.order.indexOf(itemId);
        const delta = toIndex - fromIndex;
        if (delta !== 0) {
          const direction: 'up' | 'down' = delta > 0 ? 'down' : 'up';
          for (let i = 0; i < Math.abs(delta); i++) reorderItem(itemId, direction);
        }
      }
    }
    setDragState(null);
  }

  const stickyBelowHeader = (
    <View style={[styles.stickyBar, { backgroundColor: theme.bg }]}>
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
    </View>
  );

  return (
    <>
    <ScreenScaffold title={t.shoppingTitle} tier="site" bottomNav={false} ownBackground={false} stickyBelowHeader={stickyBelowHeader} stickyBelowHeaderHeight={STICKY_HEIGHT} infoActive={hintOpen} onInfoToggle={() => setHintOpen((v) => !v)}>
      <View style={styles.content}>
        <HintCard text={t.hints.shopping.text} open={hintOpen} noPill />
        <SharedRequestsSection kind="shopping" />

        {tab === 'catalog' && (
          <Surface style={styles.catalogCard}>
            <View style={styles.catalogHeaderRow}>
              <Text style={[styles.catalogTitle, { color: theme.text }]}>{t.monthlyTabLabel}</Text>
              <View style={styles.catalogHeaderActions}>
                <Pressable
                  style={styles.resetIconBtn}
                  onPress={handleManualMonthlyReset}
                  hitSlop={6}
                  accessibilityLabel={t.resetMonthlyListAction}
                >
                  <Ionicons name="refresh-circle" size={32} color="#E53935" />
                </Pressable>
                <IconButton
                  icon={catalogLocked ? 'lock-closed' : 'lock-open-outline'}
                  label={catalogLocked ? t.unlockListButtonLabel : t.lockListButtonLabel}
                  onPress={() => setCatalogLocked((v) => !v)}
                  active={catalogLocked}
                />
              </View>
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

              {/* SECTION 1 — Monthly list (things the user has added) */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: theme.accent }]}>{t.monthlyListSection}</Text>
                  <View style={[styles.sectionRule, { backgroundColor: theme.accent }]} />
                </View>
                {catalogItems.length === 0 ? (
                  <Text style={[styles.sectionEmpty, { color: theme.textMuted }]}>{t.monthlyListEmpty}</Text>
                ) : (
                  <>
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
                                  onIncrement={!catalogLocked ? () => handleMonthlyQty(item, 1) : undefined}
                                  onDecrement={!catalogLocked ? () => handleMonthlyQty(item, -1) : undefined}
                                  onRemove={!catalogLocked ? () => removeWithSource(item.id) : undefined}
                                  temporaryLabel={t.temporaryBadge}
                                />
                                {idx < groupItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                              </View>
                            ))}
                          </ExpandableCard>
                        ))}
                      </View>
                    )}
                    {ungroupedRestItems.length > 0 && (
                      <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                        {ungroupedRestItems.map((item, idx) => (
                          <View key={item.id}>
                            <MonthlyTableRow
                              item={item}
                              onTogglePending={() => setPendingRestock(item.id, !item.pendingRestock)}
                              onPress={!catalogLocked ? () => setUpdateItem(item) : undefined}
                              onIncrement={!catalogLocked ? () => handleMonthlyQty(item, 1) : undefined}
                              onDecrement={!catalogLocked ? () => handleMonthlyQty(item, -1) : undefined}
                              onRemove={!catalogLocked ? () => removeWithSource(item.id) : undefined}
                              temporaryLabel={t.temporaryBadge}
                            />
                            {idx < ungroupedRestItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                          </View>
                        ))}
                      </View>
                    )}
                    {monthlyTotal > 0 && (
                      <Text style={[styles.totalLine, { color: theme.text }]}>{t.monthlyListTotal(formatKr(monthlyTotal, 0))}</Text>
                    )}
                  </>
                )}
              </View>

              {/* SECTION 2 — Catalogue (full seed catalog to pick from) */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.catalogueSection}</Text>
                  <View style={[styles.sectionRule, { backgroundColor: theme.textMuted }]} />
                </View>
                <TextInput
                  style={[styles.catalogueSearch, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                  value={catalogueSearch}
                  onChangeText={setCatalogueSearch}
                  placeholder={t.catalogueSearchPlaceholder}
                  placeholderTextColor={theme.textMuted}
                  editable={!catalogLocked}
                />
                <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                  {filteredSeedCatalog.map((seed, idx) => {
                    const inMonthly = monthlyByName.get(seed.name.trim().toLowerCase());
                    return (
                      <View key={seed.id}>
                        <View style={styles.catalogueRow}>
                          <Text style={[styles.catalogueName, { color: theme.text }]} numberOfLines={1}>{seed.name}</Text>
                          {seed.price > 0 && (
                            <Text style={[styles.cataloguePrice, { color: theme.textMuted }]}>{formatKr(seed.price, 0)}</Text>
                          )}
                          {inMonthly ? (
                            <View style={styles.catalogueStepper}>
                              <Pressable style={[styles.catalogueStepBtn, { backgroundColor: theme.surfaceMuted }]} onPress={() => !catalogLocked && handleMonthlyQty(inMonthly, -1)} hitSlop={6}>
                                <Text style={[styles.catalogueStepText, { color: theme.text }]}>−</Text>
                              </Pressable>
                              <Text style={[styles.catalogueQty, { color: theme.text }]}>{inMonthly.targetQuantity}</Text>
                              <Pressable style={[styles.catalogueStepBtn, { backgroundColor: theme.accent }]} onPress={() => !catalogLocked && handleMonthlyQty(inMonthly, 1)} hitSlop={6}>
                                <Text style={[styles.catalogueStepText, { color: theme.accentInk }]}>+</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              style={[styles.catalogueAddBtn, { backgroundColor: theme.accent }, catalogLocked && styles.createDishBtnDisabled]}
                              onPress={() => !catalogLocked && handleAddSeedToMonthly(seed)}
                              hitSlop={6}
                            >
                              <Ionicons name="add" size={16} color={theme.accentInk} />
                            </Pressable>
                          )}
                        </View>
                        {idx < filteredSeedCatalog.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                      </View>
                    );
                  })}
                </View>
                <AddDivider onPress={() => setAddItemTarget({ origin: 'catalog' })} disabled={catalogLocked} />
              </View>

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
                  ungroupedUnchecked={displayUngrouped}
                  checked={groups.checked}
                  purchased={purchasedByListId.get(list.id) ?? []}
                  onToggleLock={() => toggleListLocked(list.id)}
                  onRename={(name) => renameList(list.id, name)}
                  onOpenSavedLists={() => setSavedListsListId(list.id)}
                  onOpenListSettings={() => setListSettingsListId(list.id)}
                  onDelete={() => handleDeleteList(list.id)}
                  onToggleItem={(item) => toggle(item.id)}
                  onRemoveItem={handleRemoveWeeklyItem}
                  onIncrementItem={(item) => adjustAmount(item.id, 1)}
                  onDecrementItem={(item) => adjustAmount(item.id, -1)}
                  onDecrementCartItem={handleDecrementCartItem}
                  onAddInlineItem={(input) => {
                    add({
                      name: input.name,
                      amount: String(input.qty),
                      unit: '',
                      listType: 'weekly',
                      store: '',
                      price: input.price,
                      inventoryQty: 0,
                      isTemporary: false,
                      targetQuantity: input.qty,
                      status: 'inWeeklyList',
                      listId: list.id,
                    });
                    success();
                    setConfirm(t.itemAddedToList(input.name));
                  }}
                  monthlyItems={catalogItems}
                  onAddMonthlyToWeek={(item) => {
                    addToWeeklyFromCatalog(item.id, parseInt(item.amount, 10) || 1, list.id);
                    success();
                    setConfirm(t.itemAddedToList(item.name));
                  }}
                  onDoneShopping={() => handleDoneShopping(list, groupsProgress.inCart)}
                  renderReorderableRow={(item) => (
                    <DraggableTaskRow
                      isOpen={false}
                      registerNode={(node) => handleRegisterRowNode(list.id, item.id, node)}
                      onDragStart={() => handleDragStart(list.id, item.id, item.name, order)}
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
              style={[styles.newListCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
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
        onSetActiveWeeks={(weeks) => {
          if (listSettingsListId) setListActiveWeeks(listSettingsListId, weeks);
        }}
      />
    </ScreenScaffold>
    {/* "Create grouping" FAB — bottom-right on both tabs; opens the full dish-builder screen. */}
    <Pressable
      style={[styles.fab, { backgroundColor: theme.good }]}
      onPress={() => router.push('/create-grouping')}
      accessibilityRole="button"
      accessibilityLabel={t.createGroupingBtn}
    >
      <Ionicons name="add" size={20} color={theme.textInverse} />
      <Text style={[styles.fabText, { color: theme.textInverse }]}>{t.createGroupingBtn}</Text>
    </Pressable>
    <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />

    <Modal visible={resetConfirmVisible} transparent animationType="fade" onRequestClose={() => setResetConfirmVisible(false)}>
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.dialogMessage, { color: theme.text }]}>{t.resetMonthlyListConfirmTitle}</Text>
          <View style={styles.dialogBtns}>
            <Pressable style={[styles.dialogBtn, styles.dialogBtnNo]} onPress={() => setResetConfirmVisible(false)}>
              <Text style={styles.dialogBtnText}>{t.no}</Text>
            </Pressable>
            <Pressable style={[styles.dialogBtn, styles.dialogBtnYes]} onPress={handleConfirmReset}>
              <Text style={styles.dialogBtnText}>{t.yes}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  bodyGap: { gap: Spacing.md },
  dishGroupsWrap: { gap: Spacing.xs },
  // Floating "Create grouping" button — sits above BottomNav in the bottom-right corner.
  fab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    minHeight: 48,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },

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
  catalogHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  resetIconBtn: { alignItems: 'center', justifyContent: 'center' },
  catalogTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold },

  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  dialogBox: { borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 340, gap: Spacing.lg },
  dialogMessage: { fontSize: FontSize.md, fontFamily: Fonts.semibold, textAlign: 'center' },
  dialogBtns: { flexDirection: 'row', gap: Spacing.sm },
  dialogBtn: { flex: 1, borderRadius: Radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm },
  dialogBtnNo: { backgroundColor: '#1E3A5F' },
  dialogBtnYes: { backgroundColor: '#4A90D9' },
  dialogBtnText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: FontSize.sm, textAlign: 'center' },
  createDishBtnDisabled: { opacity: 0.4 },
  sectionEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.sm },
  totalLine: { fontSize: FontSize.md, fontFamily: Fonts.bold, textAlign: 'right', marginTop: 4 },
  catalogueSearch: { borderRadius: Radius.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, fontSize: FontSize.md },
  catalogueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  catalogueName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  cataloguePrice: { fontSize: FontSize.xs },
  catalogueAddBtn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  catalogueStepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catalogueStepBtn: { width: 26, height: 26, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  catalogueStepText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  catalogueQty: { fontSize: FontSize.sm, fontFamily: Fonts.bold, minWidth: 20, textAlign: 'center' },

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
