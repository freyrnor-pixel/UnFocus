/**
 * shopping.tsx — Shopping hub with four in-place tabs: Weekly, Monthly, Food, Catalogue.
 *
 * Tabbed shopping screen. The "Week lists" tab renders an "Unallocated" card (dish
 * ingredients pushed to the week from the Food tab, sentinel listId UNALLOCATED_LIST_ID)
 * then one WeekListCard per non-template shopping_lists row plus an empty "create new
 * list" card. The "Monthly list" tab is a single lock-gated card (staging tray,
 * dish-grouped + ungrouped curated items, an add-to-monthly divider, purchased-this-month
 * history). "Food" renders components/FoodTab (dish library + push-to-list) and
 * "Catalogue" renders components/CatalogueTab (the master item catalogue). A screen-level
 * sticky bar (Decision 011 A2-1) holds the 4-tab switcher plus a per-tab summary line.
 *
 * Connections:
 *   Imports → components/AddItemSheet, components/HintCard,
 *             components/AppModal (showAppModal),
 *             components/ConfirmationBanner, components/DraggableTaskRow,
 *             components/ExpandableCard, components/FlightOverlay (FlightPill, Flight, FlightRect),
 *             components/IconButton,
 *             components/ListSettingsSheet, components/MonthlyResetSummaryModal,
 *             components/MonthlyTableRow, components/ProgressBar, components/SavedListsModal,
 *             components/ScreenScaffold, components/SharedRequestsSection,
 *             components/ShoppingRow, components/Surface, components/UpdateSheet,
 *             components/WeekListCard, components/FoodTab, components/CatalogueTab,
 *             components/PressableScale, constants/theme,
 *             lib/date (todayStr, dateStr, getWeekRangeContaining), lib/haptics (success,
 *             heavy, warning), lib/i18n, lib/money (formatKr), lib/shoppingGroups (groupByDish,
 *             computeListGroups, listProgress), lib/useAppTheme,
 *             store/useSettingsStore, store/useShoppingListStore,
 *             store/useShoppingStore (incl. UNALLOCATED_LIST_ID), @expo/vector-icons (Ionicons)
 *   Used by → Expo Router route "/shopping" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → useShoppingStore (items/trips) + useShoppingListStore (lists, incl. each
 *             list's locked/isTemplate state) + useSettingsStore (monthlyResetDate).
 *             CatalogueTab/WeekListCard/FoodTab read useCatalogStore internally (loaded at
 *             startup by app/_layout.tsx). FoodTab additionally drives useMealStore.
 *
 * Edit notes:
 *   - **Sticky-bar label fix (visual-audit, 2026-07-11)**: the summary-row ternary fell
 *     through to a `tab === 'food' ? foodTabLabel : catalogueTabLabel` catch-all for any
 *     tab that wasn't `'monthly'` or `'weekly'`-with-a-`focusedList` — so a fresh/empty
 *     Weekly tab (no focused list yet) showed "Katalog" instead of "Ukelister". Added an
 *     explicit `tab === 'weekly'` branch before the catch-all.
 *   - **Decision 044a (2026-07-09):** removed the Monthly tab's staging tray
 *     (per-item pendingRestock checkbox → confirm button); MonthlyTableRow's checkbox
 *     now calls addToWeeklyFromCatalog directly, with undo via putBackToInventory in
 *     the confirmation toast. `pendingRestock` stays in the type/DB as vestigial.
 *     Also deleted `components/AddSourceChooser.tsx` and its `addSourceChooserListId`
 *     wiring here — both were already dead code (the weekly "+" flow it served was
 *     superseded by WeekListCard's inline add row back on 2026-07-06; nothing ever
 *     set `addSourceChooserListId` to a real id). `AddItemSheet` is catalog-only now
 *     — see its own header.
 *   - **Shopping/Food redesign (2026-07-08)**: four in-place tabs now — Weekly, Monthly,
 *     Food, Catalogue (all switch content in place; none navigate to a separate screen).
 *     The old /meals and /create-grouping screens were DELETED; the "Create grouping" FAB
 *     is gone. Food (components/FoodTab) is where dishes are made now — meal-type sections
 *     (glass-tinted per meal colour), each dish a collapsed row (name · total price · "+"),
 *     "+" opening a popup with "Add to week list" (→ weekly Unallocated bucket) / "Add to
 *     monthly list" (→ status:'catalog'), expandable to ingredient rows. Catalogue
 *     (components/CatalogueTab) is the master item list, sectioned by type, with add/edit/
 *     delete. The Monthly tab dropped its embedded seed-catalogue section (moved to the
 *     Catalogue tab) and keeps a direct add-to-monthly trigger (bordered pill, matching
 *     WeekListCard's monthlyTrigger shape — design-consistency pass replaced the earlier
 *     AddFAB size="sm" bubble, which itself had replaced an even earlier AddDivider "—+—"
 *     line). Weekly gained the Unallocated card; each unallocated dish/item can be
 *     allocated into a real dated list. Weekly's "New list" action is the same trigger-pill
 *     family, sized more prominently as the tab's primary action.
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
 *     also use `overlay` (the earlier doc-vs-source inconsistency flagged here has since
 *     been fixed in both files).
 *     Reserved sticky height is now conditional: `STICKY_HEIGHT` (tab row + summary row) only
 *     when the Weekly summary row actually renders, else `STICKY_HEIGHT_TABS` (tab row only),
 *     so non-Weekly tabs don't reserve empty space above the first card (visual-audit gap fix).
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
 *   - **Mount-time store hydration**: app/_layout.tsx loads every store at startup now, so
 *     this screen's focus effect no longer re-initialises the DB or re-hydrates
 *     settings/shopping/list/catalog — it only runs the behavior that's more than hydration:
 *     advanceRecurringLists(today) (re-loading shopping items after, since it writes
 *     shopping_items rows directly) and the automatic payday-boundary monthly-reset detection
 *     (buildMonthlyResetSummary BEFORE monthlyReset, then persists lastMonthlyReset).
 *   - The 'shopping_opened' automation trigger fires once per mount; rules are already loaded
 *     by _layout's startup bootstrap. "Shopping done!"'s Scan/Upload choices route to /scan
 *     (autoCapture camera/library); Skip commits the trip in place.
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
 *   - **Flight animation (Phase 1, 2026-07-11)**: list→cart toggles fly a `FlightPill`
 *     clone from the toggled row's rect to the target list's "In cart" section header,
 *     reusing the same window-space `measureInWindow` idiom as the drag-to-merge code
 *     above. `cartHeaderNodes` (keyed by listId) is the destination registry, populated by
 *     WeekListCard's `registerCartHeaderNode`; `flights` is screen-owned state rendered by
 *     a single `<FlightOverlay>` mounted as a sibling of `<ScreenScaffold>` (NOT inside
 *     it — ScreenScaffold's children scroll inside its internal ScrollView, same reasoning
 *     as `ConfirmationBanner`'s placement below). `handleScreenScroll` clears in-flight
 *     flights on scroll since window-space coords go stale. See
 *     ANIMATION_GUIDELINES.md's "Flight / Cross-Section Travel Animations" section.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Modal, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShoppingStore, ShoppingItem, MonthlyResetSummary, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useShoppingListStore, ShoppingList } from '@/store/useShoppingListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAutomationStore } from '@/store/useAutomationStore';
import ShoppingRow from '@/components/ShoppingRow';
import EmptyState from '@/components/EmptyState';
import MonthlyTableRow from '@/components/MonthlyTableRow';
import AddItemSheet from '@/components/AddItemSheet';
import UpdateSheet from '@/components/UpdateSheet';
import MonthlyResetSummaryModal from '@/components/MonthlyResetSummaryModal';
import SharedRequestsSection from '@/components/SharedRequestsSection';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import { showAppModal } from '@/components/AppModal';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import ExpandableCard from '@/components/ExpandableCard';
import PressableScale from '@/components/PressableScale';
import WeekListCard from '@/components/WeekListCard';
import FlightOverlay, { FlightRow, Flight, FlightRect } from '@/components/FlightOverlay';
import FoodTab from '@/components/FoodTab';
import CatalogueTab from '@/components/CatalogueTab';
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
import { getDomainColor } from '@/lib/domainColor';

type Tab = 'weekly' | 'monthly' | 'food' | 'catalogue';

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

// Reserved sticky-bar height. The summary row (focused list name + progress) only renders
// on the Weekly tab, so reserving the full height on every tab left a large empty gap above
// the first card (visual-audit finding). Reserve the tab-row-only height otherwise, matching
// Plans' 56 so the tab→first-card gap is consistent across the two list screens.
const STICKY_HEIGHT = 116;
const STICKY_HEIGHT_TABS = 60;

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
  const mealDomainColor = getDomainColor(theme, 'meal');
  const shopDomainColor = getDomainColor(theme, 'shop');

  // Fire the 'shopping_opened' automation trigger once per screen visit (mount).
  // Rules are already loaded by app/_layout.tsx's startup bootstrap.
  useEffect(() => {
    useAutomationStore.getState().fireTrigger('shopping_opened');
  }, []);

  const [tab, setTab] = useState<Tab>('weekly');
  const [hintOpen, setHintOpen] = useState(false);
  const [focusedListId, setFocusedListId] = useState<string | null>(null);
  const [addToCatalogOpen, setAddToCatalogOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState<(() => void) | null>(null);
  /** Shows a toast; pass `undo` to add an inline "Undo" action (Decision 044a). */
  const setConfirm = useCallback((message: string | null, undo?: () => void) => {
    setConfirmMessage(message);
    setConfirmUndo(() => undo ?? null);
  }, []);
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

  // ── Flight animation (Phase 1, 2026-07-11): list→cart toggle flies a floating clone
  // from its measured source rect to the target list's "In cart" section header, both in
  // window space (same measureInWindow idiom as the drag refs above). Cancelled on scroll
  // (see handleScreenScroll) since window-space coords go stale once the user scrolls.
  const cartHeaderNodes = useRef<Map<string, any>>(new Map());
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightCounter = useRef(0);
  const lastScrollY = useRef(0);

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
  const doneShopping = useShoppingStore((s) => s.doneShopping);
  const monthlyReset = useShoppingStore((s) => s.monthlyReset);
  const buildMonthlyResetSummary = useShoppingStore((s) => s.buildMonthlyResetSummary);
  const reorderItem = useShoppingStore((s) => s.reorder);
  const mergeItems = useShoppingStore((s) => s.mergeItems);
  const recentlyAddedIds = useShoppingStore((s) => s.recentlyAddedIds);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
  const weeklyResetDay = useSettingsStore((s) => s.weeklyResetDay);

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
  const loadShopping = useShoppingStore((s) => s.load);
  const updateSettings = useSettingsStore((s) => s.update);

  const nonTemplateLists = useMemo(() => lists.filter((l) => !l.isTemplate), [lists]);
  const templateLists = useMemo(() => lists.filter((l) => l.isTemplate), [lists]);
  const focusedList = useMemo(
    () => nonTemplateLists.find((l) => l.id === focusedListId) ?? nonTemplateLists[0],
    [nonTemplateLists, focusedListId]
  );

  // Recurring-list roll-forward + payday reset detection. Runs on every focus;
  // also closes both add sheets on blur (mirrors the old app: the receipt
  // pop-up's Scan/Upload choices would otherwise leave a sheet open behind
  // whatever screen it pushed to).
  useFocusEffect(
    useCallback(() => {
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
      // Read settings via getState() (not a render-time selector) so we see the latest
      // persisted values. buildMonthlyResetSummary() must run BEFORE monthlyReset()
      // clears the purchased rows it reads.
      const periodKey = today.slice(0, 7); // YYYY-MM
      const settings = useSettingsStore.getState();
      const alreadyResetThisPeriod = settings.lastMonthlyReset.slice(0, 7) === periodKey;
      if (!alreadyResetThisPeriod && new Date().getDate() >= settings.monthlyResetDate) {
        setResetSummary(buildMonthlyResetSummary());
        monthlyReset();
        updateSettings({ lastMonthlyReset: today });
      }

      return () => {
        setAddToCatalogOpen(false);
        setHintOpen(false);
      };
    }, [loadShopping, advanceRecurringLists, buildMonthlyResetSummary, monthlyReset, updateSettings])
  );

  const catalogItems = useMemo(
    () => items.filter((i) => i.status === 'catalog').sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  const { dishGroups: catalogDishGroups, ungrouped: ungroupedRestItems } = useMemo(
    () => groupByDish(catalogItems),
    [catalogItems]
  );

  // Running total of the curated Monthly list (price × targetQuantity per row).
  const monthlyTotal = useMemo(
    () => catalogItems.reduce((sum, i) => sum + i.price * i.targetQuantity, 0),
    [catalogItems]
  );
  // Weekly "Unallocated" bucket — dish ingredients pushed to the week from the Food tab
  // that haven't been assigned to a dated list yet (status inWeeklyList, sentinel listId).
  const unallocatedItems = useMemo(
    () => items.filter((i) => i.status === 'inWeeklyList' && i.listId === UNALLOCATED_LIST_ID && !i.checked),
    [items]
  );
  const { dishGroups: unallocatedDishGroups, ungrouped: unallocatedUngrouped } = useMemo(
    () => groupByDish(unallocatedItems),
    [unallocatedItems]
  );

  const purchasedByTrip = useMemo(() => {
    const purchased = items.filter((i) => i.status === 'purchased' && i.shoppingTripId);
    return trips
      .map((trip) => ({ trip, tripItems: purchased.filter((i) => i.shoppingTripId === trip.id) }))
      .filter((g) => g.tripItems.length > 0);
  }, [items, trips]);

  const ukelisteBadge = useMemo(
    () =>
      items.filter(
        (i) =>
          i.status === 'inWeeklyList' &&
          !i.checked &&
          (i.listId === UNALLOCATED_LIST_ID || nonTemplateLists.some((l) => l.id === i.listId))
      ).length,
    [items, nonTemplateLists]
  );

  // Decision 044b — cross-tab cue: true while at least one item just landed in the weekly
  // list (Monthly checkbox, Food "Add to week list") and the user isn't looking at Weekly
  // already. Derived straight from the store's self-expiring recentlyAddedIds map, so it
  // clears itself both on tab switch (this expression goes false) and after ~1.8s (the
  // map entry expires) — no extra effect/timer needed here.
  const weeklyAddCue = useMemo(
    () => tab !== 'weekly' && items.some((i) => i.status === 'inWeeklyList' && recentlyAddedIds[i.id]),
    [tab, items, recentlyAddedIds]
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

  // Monthly checkbox (Decision 044a): moves the item straight to the focused weekly
  // list instead of staging it for a separate confirm step. Undoable via the toast.
  function handleAddToWeeklyFromMonthly(item: ShoppingItem) {
    if (!focusedList) {
      setConfirm(t.noWeekListsYet);
      return;
    }
    addToWeeklyFromCatalog(item.id, 1, focusedList.id);
    success();
    setConfirm(t.itemAddedToNamedList(item.name, focusedList.name), () => putBackToInventory(item.id));
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

  function handleAddItem(input: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) {
    add({ name: input.name, amount: '1', unit: '', listType: 'monthly', store: '', price: input.price, inventoryQty: 0, isTemporary: input.isTemporary, targetQuantity: input.targetQuantity, status: 'catalog' });
    setAddToCatalogOpen(false);
    success();
    setConfirm(t.itemAddedToInventory(input.name));
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

  // ── Weekly "Unallocated" allocation ──
  // Move an unallocated ingredient (or a whole dish's worth) into a real dated week list.
  // Offers one button per existing non-template list; nothing to do if none exist yet.
  function handleAllocate(itemsToMove: ShoppingItem[]) {
    if (itemsToMove.length === 0) return;
    if (nonTemplateLists.length === 0) {
      setConfirm(t.noWeekListsYet);
      return;
    }
    showAppModal(t.allocateToListTitle, '', [
      ...nonTemplateLists.map((l) => ({
        text: l.name,
        onPress: () => {
          for (const it of itemsToMove) update(it.id, { listId: l.id });
          success();
          setConfirm(t.itemsAddedToList(itemsToMove.length));
        },
      })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
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

  // ── Flight animation (Phase 1) ──

  function handleRegisterCartHeaderNode(listId: string, node: any) {
    if (node) cartHeaderNodes.current.set(listId, node);
    else cartHeaderNodes.current.delete(listId);
  }

  function handleFlightStart(listId: string, item: ShoppingItem, from: FlightRect) {
    const destNode = cartHeaderNodes.current.get(listId);
    if (!destNode?.measureInWindow) return; // no "In cart" section mounted yet — falls back to today's fade
    destNode.measureInWindow((x: number, y: number, width: number, height: number) => {
      flightCounter.current += 1;
      const key = `${item.id}-${flightCounter.current}`;
      setFlights((prev) => [
        ...prev.filter((f) => f.itemId !== item.id),
        { key, itemId: item.id, from, to: { x, y, width, height }, content: <FlightRow item={item} width={from.width} /> },
      ]);
    });
  }

  function handleFlightEnd(key: string) {
    setFlights((prev) => prev.filter((f) => f.key !== key));
  }

  function handleScreenScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    if (Math.abs(y - lastScrollY.current) > 4 && flights.length > 0) setFlights([]);
    lastScrollY.current = y;
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

  const TAB_META: { value: Tab; label: string; accent: string; count: number }[] = [
    { value: 'weekly', label: t.weeklyTabLabel, accent: theme.good, count: ukelisteBadge },
    { value: 'monthly', label: t.monthlyTabLabel, accent: theme.accent, count: 0 },
    { value: 'food', label: t.foodTabLabel, accent: mealDomainColor.accent, count: 0 },
    { value: 'catalogue', label: t.catalogueTabLabel, accent: shopDomainColor.accent, count: 0 },
  ];

  const summaryVisible = tab === 'weekly' && !!focusedList && !!focusedProgress;
  const stickyHeight = summaryVisible ? STICKY_HEIGHT : STICKY_HEIGHT_TABS;
  const stickyBelowHeader = (
    <View style={[styles.stickyBar, { backgroundColor: theme.bg }]}>
      <View style={styles.tabsRow}>
        {TAB_META.map(({ value, label, accent, count }) => {
          const isActive = tab === value;
          return (
            <PressableScale
              key={value}
              style={[styles.tab, isActive && { borderBottomColor: accent, borderBottomWidth: 2 }]}
              onPress={() => setTab(value)}
              accessibilityRole="button"
              accessibilityLabel={label}
              scaleTo={0.97}
            >
              <Text style={[styles.tabText, { color: isActive ? accent : theme.textMuted }]} numberOfLines={1}>
                {label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? accent : theme.surfaceMuted }]}>
                  <Text style={[styles.tabBadgeText, { color: isActive ? theme.accentInk : theme.textMuted }]}>{count}</Text>
                </View>
              )}
              {/* Decision 044b — cross-tab cue: a small tick pops onto the Weekly tab when an
                  add from Monthly/Food just landed there while the user is looking elsewhere. */}
              {value === 'weekly' && weeklyAddCue && (
                <Animated.View
                  entering={reducedMotion ? undefined : ZoomIn.duration(200)}
                  exiting={reducedMotion ? undefined : ZoomOut.duration(150)}
                  style={[styles.tabCue, { backgroundColor: theme.good }]}
                >
                  <Ionicons name="checkmark" size={10} color={theme.textInverse} />
                </Animated.View>
              )}
            </PressableScale>
          );
        })}
      </View>

      {/* Visual-audit 2026-07-11: dropped the plain tab-name echo here for monthly/food/
          catalogue/weekly-without-a-list — the active tab button above already names it,
          so a second "Monthly list"/"Katalog" line right underneath was pure repetition.
          This row only earns its place when it carries information the tab button
          doesn't: the focused list's own name + live progress. */}
      {tab === 'weekly' && focusedList && focusedProgress ? (
        <View style={styles.stickySummaryRow}>
          <Text style={[styles.stickyListName, { color: theme.text }]} numberOfLines={1}>{focusedList.name}</Text>
          <Text style={[styles.stickyProgressText, { color: theme.textMuted }]}>
            {t.shoppingRemaining(focusedProgress.remaining, focusedProgress.inCart)}
          </Text>
          <ProgressBar value={focusedProgress.pct} state="good" height={6} style={styles.stickyProgressBar} />
        </View>
      ) : null}
    </View>
  );

  return (
    <>
    <ScreenScaffold title={t.shoppingTitle} tier="site" bottomNav={false} ownBackground={false} stickyBelowHeader={stickyBelowHeader} stickyBelowHeaderHeight={stickyHeight} infoActive={hintOpen} onInfoToggle={() => setHintOpen((v) => !v)} onScroll={handleScreenScroll}>
      <View style={styles.content}>
        <HintCard text={t.hints.shopping.text} open={hintOpen} noPill />
        <SharedRequestsSection kind="shopping" />

        {tab === 'monthly' && (
          <Surface style={styles.catalogCard}>
            {/* Title on the left groups with the reset/lock actions on the right
                (space-between) — the previous right-aligned-only layout left a big empty
                gap between the tab label and the icons (2026-07-12 redesign). */}
            <View style={styles.catalogHeaderRow}>
              <Text style={[styles.catalogHeaderTitle, { color: theme.text }]}>{t.monthlyListSection}</Text>
              <View style={styles.catalogHeaderActions}>
                <PressableScale
                  style={styles.resetIconBtn}
                  onPress={handleManualMonthlyReset}
                  hitSlop={6}
                  accessibilityLabel={t.resetMonthlyListAction}
                  scaleTo={0.93}
                >
                  <Ionicons name="refresh-circle" size={32} color="#E53935" />
                </PressableScale>
                <IconButton
                  icon={catalogLocked ? 'lock-closed' : 'lock-open-outline'}
                  label={catalogLocked ? t.unlockListButtonLabel : t.lockListButtonLabel}
                  onPress={() => setCatalogLocked((v) => !v)}
                  active={catalogLocked}
                />
              </View>
            </View>

            <View style={styles.bodyGap}>
              {/* SECTION 1 — Monthly list (things the user has added) */}
              <View style={styles.section}>
                <View style={[styles.sectionTitleCard, { backgroundColor: theme.surfaceMuted }]}>
                  <Text style={[styles.sectionLabel, { color: theme.accent }]}>{t.monthlyListSection}</Text>
                </View>
                {catalogItems.length === 0 ? (
                  <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.monthlyListEmpty}</Text>
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
                                  onCheckboxPress={() => handleAddToWeeklyFromMonthly(item)}
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
                              onCheckboxPress={() => handleAddToWeeklyFromMonthly(item)}
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
                {/* Add an item straight to the Monthly list. The full item catalogue now
                    lives in its own "Catalogue" tab (CatalogueTab); this keeps a direct
                    add-to-monthly affordance where the catalogue section used to sit.
                    Design-consistency pass: a bordered trigger pill (opens the AddItemSheet)
                    matching WeekListCard's "Add from monthly list" trigger — one shared shape
                    for "tap to open a fuller add flow", instead of the old circular AddFAB
                    bubble that read as a third, different add affordance on this screen. */}
                {!catalogLocked && (
                  <PressableScale
                    style={[styles.addTrigger, { borderColor: theme.accent }]}
                    onPress={() => setAddToCatalogOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t.catalogueAddNewBtn}
                    scaleTo={0.97}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={theme.accent} />
                    <Text style={[styles.addTriggerText, { color: theme.accent }]}>{t.catalogueAddNewBtn}</Text>
                  </PressableScale>
                )}
              </View>

              {purchasedByTrip.length > 0 && (
                <View style={styles.section}>
                  <View style={[styles.sectionTitleCard, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.purchasedThisMonthSection}</Text>
                  </View>
                  {purchasedByTrip.map(({ trip, tripItems }) => {
                    const expanded = purchasedExpanded === trip.id;
                    return (
                      <View key={trip.id}>
                        <PressableScale style={[styles.sectionHeaderRow, { backgroundColor: theme.surfaceMuted }]} onPress={() => setPurchasedExpanded(expanded ? null : trip.id)} scaleTo={0.97}>
                          <Text style={[styles.weekLabel, { color: theme.textMuted }]}>{trip.label}</Text>
                          <Text style={[styles.disclosureChevron, { color: theme.textMuted }]}>{expanded ? '▲' : '▼'}</Text>
                        </PressableScale>
                        {expanded && (
                          // Decision 043 rule 1: this already sits inside the Monthly tab's
                          // outer Surface (catalogCard) — plain View + theme.surface fill,
                          // matching every sibling rowsCard, instead of a second glass layer.
                          <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                            {tripItems.map((item, idx) => (
                              <View key={item.id}>
                                <ShoppingRow item={item} variant="purchased" onToggle={() => {}} onRemove={() => removeWithSource(item.id)} />
                                {idx < tripItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                              </View>
                            ))}
                          </View>
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

            {/* ── Unallocated: dishes added "to the week" from the Food tab, not yet in a dated list ──
                Decision 043 rule 3: featMeal lives on the 4px accent bar only, not the whole
                card's material (a Surface `tint` used to recolor the entire fill/sheen). */}
            {unallocatedItems.length > 0 && (
              <Surface style={[styles.unallocatedCard, styles.unallocatedCardRow]}>
                <View style={[styles.unallocatedAccent, { backgroundColor: mealDomainColor.accent }]} />
                <View style={styles.unallocatedContent}>
                <View style={styles.unallocatedHeader}>
                  <Ionicons name="fast-food-outline" size={18} color={theme.text} />
                  <Text style={[styles.unallocatedTitle, { color: theme.text }]}>{t.unallocatedSection}</Text>
                </View>
                <Text style={[styles.unallocatedHint, { color: theme.textMuted }]}>{t.unallocatedHint}</Text>

                {unallocatedDishGroups.map(([dishName, groupItems]) => (
                  <View key={dishName} style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                    <View style={styles.unallocatedGroupHeader}>
                      <Text style={[styles.unallocatedGroupName, { color: theme.text }]} numberOfLines={1}>{dishName}</Text>
                      <PressableScale style={[styles.allocateBtn, { backgroundColor: theme.good }]} onPress={() => handleAllocate(groupItems)} hitSlop={6} scaleTo={0.97}>
                        <Ionicons name="arrow-forward" size={14} color={theme.textInverse} />
                        <Text style={[styles.allocateBtnText, { color: theme.textInverse }]}>{t.allocateItemLabel}</Text>
                      </PressableScale>
                    </View>
                    {groupItems.map((item, idx) => (
                      <View key={item.id}>
                        <View style={[styles.unallocatedRow, { borderTopColor: theme.border }, idx > 0 && styles.unallocatedRowBorder]}>
                          <Text style={[styles.unallocatedItemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                          <Text style={[styles.unallocatedItemMeta, { color: theme.textMuted }]}>
                            {item.amount}{item.unit ? ` ${item.unit}` : ''}{item.price > 0 ? ` · ${formatKr(item.price, 0)}` : ''}
                          </Text>
                          <PressableScale onPress={() => removeWithSource(item.id)} hitSlop={8} accessibilityLabel={t.removeItemLabel} scaleTo={0.93}>
                            <Ionicons name="close" size={18} color={theme.textMuted} />
                          </PressableScale>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

                {unallocatedUngrouped.length > 0 && (
                  <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                    {unallocatedUngrouped.map((item, idx) => (
                      <View key={item.id} style={[styles.unallocatedRow, idx > 0 && styles.unallocatedRowBorder, { borderTopColor: theme.border }]}>
                        <Text style={[styles.unallocatedItemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                        <Text style={[styles.unallocatedItemMeta, { color: theme.textMuted }]}>
                          {item.amount}{item.unit ? ` ${item.unit}` : ''}{item.price > 0 ? ` · ${formatKr(item.price, 0)}` : ''}
                        </Text>
                        <PressableScale style={[styles.allocateBtn, { backgroundColor: theme.good }]} onPress={() => handleAllocate([item])} hitSlop={6} scaleTo={0.97}>
                          <Ionicons name="arrow-forward" size={14} color={theme.textInverse} />
                        </PressableScale>
                        <PressableScale onPress={() => removeWithSource(item.id)} hitSlop={8} accessibilityLabel={t.removeItemLabel} scaleTo={0.93}>
                          <Ionicons name="close" size={18} color={theme.textMuted} />
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                )}
                </View>
              </Surface>
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
                  registerCartHeaderNode={(node) => handleRegisterCartHeaderNode(list.id, node)}
                  onFlightStart={(item, rect) => handleFlightStart(list.id, item, rect)}
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
                        onFlightStart={(rect) => handleFlightStart(list.id, item, rect)}
                      />
                    </DraggableTaskRow>
                  )}
                />
              );
            })}

            {nonTemplateLists.length === 0 && unallocatedItems.length === 0 && (
              <Surface style={styles.weekEmptyCard}>
                <EmptyState
                  icon="cart-outline"
                  title={t.weekEmptyTitle}
                  body={t.weekEmptyBody}
                />
              </Surface>
            )}

            {/* Creating a new list has no single text field to fill (it's auto-named by
                date range, then offers a start-empty/from-saved choice), so it doesn't fit
                the AddRow shape — it's a "tap to open a chooser" trigger like the other two
                on this screen (monthlyTrigger, the Monthly-tab addTrigger), just sized more
                prominently since it's the primary action on this tab. */}
            <PressableScale
              style={[styles.newListTrigger, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
              onPress={() =>
                showAppModal(t.newWeeklyListTitle, '', [
                  { text: t.startEmptyList, onPress: handleCreateNewWeeklyList },
                  { text: t.savedListsTitle, onPress: () => setSavedListsListId('__new__') },
                  { text: t.cancel, style: 'cancel' },
                ])
              }
              accessibilityRole="button"
              accessibilityLabel={t.newWeeklyListTitle}
              scaleTo={0.97}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.accent} />
              <Text style={[styles.newListTriggerText, { color: theme.accent }]}>{t.newWeeklyListTitle}</Text>
            </PressableScale>
          </>
        )}

        {/* Food — dishes, in place (Point: "Food is just another tab, not another screen") */}
        {tab === 'food' && <FoodTab onNotify={setConfirm} />}

        {/* Catalogue — master item list, sectioned by type, with add/edit/delete */}
        {tab === 'catalogue' && <CatalogueTab onNotify={setConfirm} />}
      </View>

      <AddItemSheet
        visible={addToCatalogOpen}
        onClose={() => setAddToCatalogOpen(false)}
        onAdd={handleAddItem}
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
    <FlightOverlay flights={flights} onFlightEnd={handleFlightEnd} />
    <ConfirmationBanner
      message={confirmMessage}
      onDismiss={() => setConfirm(null)}
      actionLabel={confirmUndo ? t.undoBtn : undefined}
      onAction={confirmUndo ?? undefined}
    />

    <Modal visible={resetConfirmVisible} transparent animationType="fade" onRequestClose={() => setResetConfirmVisible(false)}>
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.dialogMessage, { color: theme.text }]}>{t.resetMonthlyListConfirmTitle}</Text>
          <View style={styles.dialogBtns}>
            <PressableScale style={[styles.dialogBtn, styles.dialogBtnNo]} onPress={() => setResetConfirmVisible(false)} scaleTo={0.97}>
              <Text style={styles.dialogBtnText}>{t.no}</Text>
            </PressableScale>
            <PressableScale style={[styles.dialogBtn, styles.dialogBtnYes]} onPress={handleConfirmReset} scaleTo={0.93}>
              <Text style={styles.dialogBtnText}>{t.yes}</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  // Decision 043 rule 2: Spacing.xl above each of the Monthly tab's two named sections.
  bodyGap: { gap: Spacing.xl },
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
  tabCue: { width: 16, height: 16, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stickySummaryRow: { gap: 4, paddingBottom: Spacing.xs },
  stickyListName: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  stickyProgressText: { fontSize: FontSize.xs },
  stickyProgressBar: { marginTop: 2 },

  catalogCard: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catalogHeaderTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  catalogHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Bordered trigger pill — matches WeekListCard's monthlyTrigger shape, the one shared
  // "tap to open a fuller add flow" affordance (design-consistency pass).
  addTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },
  addTriggerText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  resetIconBtn: { alignItems: 'center', justifyContent: 'center' },

  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  dialogBox: { borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 340, gap: Spacing.lg },
  dialogMessage: { fontSize: FontSize.md, fontFamily: Fonts.semibold, textAlign: 'center' },
  dialogBtns: { flexDirection: 'row', gap: Spacing.sm },
  dialogBtn: { flex: 1, borderRadius: Radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm },
  dialogBtnNo: { backgroundColor: '#1E3A5F' },
  dialogBtnYes: { backgroundColor: '#4A90D9' },
  dialogBtnText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: FontSize.sm, textAlign: 'center' },
  // Visual-audit 2026-07-11: background/border colour applied inline (theme) at each
  // call site — was bare muted text floating on the particle background.
  sectionEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1 },
  totalLine: { fontSize: FontSize.md, fontFamily: Fonts.bold, textAlign: 'right', marginTop: 4 },

  unsavedBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.md, padding: Spacing.sm },
  unsavedBannerText: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },

  // Weekly "Unallocated" card
  unallocatedCard: { borderRadius: Radius.lg },
  unallocatedCardRow: { flexDirection: 'row' },
  unallocatedAccent: { width: 4, alignSelf: 'stretch' },
  unallocatedContent: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  unallocatedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  unallocatedTitle: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  unallocatedHint: { fontSize: FontSize.xs },
  unallocatedGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: 4 },
  unallocatedGroupName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.bold },
  unallocatedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  unallocatedRowBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  unallocatedItemName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  unallocatedItemMeta: { fontSize: FontSize.xs },
  allocateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4, minHeight: 28 },
  allocateBtnText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },

  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  rowDivider: { height: 1 },
  section: { gap: Spacing.sm },
  // Pill background so the per-trip disclosure toggle stays legible over busy backgrounds
  // (Decision 043 rule 2's fixed anatomy — Fonts.semibold/FontSize.lg — is only for the
  // section title itself, sectionLabel below; this row is a repeatable foldout control).
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  sectionLabel: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  // Visual-audit 2026-07-11: gives Monthly-tab section titles the same surfaceMuted-card
  // treatment plans.tsx's sectionHeader() already applies — was bare text, flat/low-contrast
  // against the particle background.
  sectionTitleCard: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, marginBottom: Spacing.sm },

  disclosureChevron: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  weekLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

  weekEmptyCard: { borderRadius: Radius.lg, paddingVertical: Spacing.sm, marginBottom: Spacing.md },
  // Same bordered-pill trigger family as monthlyTrigger/addTrigger, sized up (paddingVertical
  // md, larger icon+text) since this is the primary action on the Weekly tab.
  newListTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
  },
  newListTriggerText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
});
