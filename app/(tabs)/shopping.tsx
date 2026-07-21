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
 * sticky bar (Decision 011 A2-1) holds the 4-tab switcher plus a per-tab summary line. A
 * bordered Budget pill sits at the top of the shared intro chrome (all 4 tabs) and pushes
 * to app/budget.tsx — the only entry point into Budget now (2026-07-19; it used to also be
 * reachable from app/(tabs)/scan.tsx, removed).
 *
 * Connections:
 *   Imports → components/InlineAddItem, components/AddDishSheet (AddDishTarget type),
 *             components/HintCard, components/AppModal (showAppModal),
 *             components/ConfirmationBanner, components/DraggableTaskRow,
 *             components/ExpandableCard, components/FlightOverlay (FlightPill, Flight, FlightRect),
 *             components/IconButton,
 *             components/ListSettingsSheet, components/MonthlyResetSummaryModal,
 *             components/MonthlyResetReviewSheet,
 *             components/MonthlyTableRow, components/SavedListsModal,
 *             components/ScreenScaffold, components/SharedRequestsSection,
 *             components/ShoppingRow, components/Surface, components/UpdateSheet,
 *             components/WeekListCard, components/FoodTab, components/CatalogueTab,
 *             components/PressableScale, components/TabBoxHighlight, constants/theme,
 *             lib/date (todayStr, dateStr, getWeekRangeContaining), lib/haptics (success,
 *             heavy, warning), lib/i18n, lib/money (formatKr), lib/shoppingGroups (groupByDish,
 *             groupByCategory, computeListGroups, listProgress),
 *             lib/shoppingCategories (categoryPresets, categoryLabel),
 *             lib/reorder (reorderByDrag), lib/useAppTheme,
 *             lib/useFirstVisitHint, lib/domainColor, lib/screenColor,
 *             store/useSettingsStore, store/useShoppingListStore,
 *             store/useShoppingStore (incl. UNALLOCATED_LIST_ID), @expo/vector-icons (Ionicons)
 *   Used by → Expo Router route "/shopping" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → useShoppingStore (items/trips) + useShoppingListStore (lists, incl. each
 *             list's locked/isTemplate state) + useSettingsStore (monthlyResetDate).
 *             CatalogueTab/WeekListCard/FoodTab read useCatalogStore internally (loaded at
 *             startup by app/_layout.tsx). FoodTab additionally drives useMealStore.
 *
 * Edit notes:
 *   - **Shopping-cleanup pass (2026-07-20)**: `addDishOpen` (boolean) became `dishSheetTarget`
 *     (`AddDishTarget | null`, from components/AddDishSheet) so the one shared `<AddDishSheet>`
 *     mount near the bottom of this file serves both Monthly's "Legg til rett" trigger
 *     (`{mode:'monthly'}`) and any Weekly WeekListCard's new "From a dish" add-chooser option
 *     (`{mode:'weekly', listId}`, via the `onOpenDishSheet` prop wired at the WeekListCard call
 *     site) — a weekly target writes straight into that list, skipping the Unallocated bucket
 *     entirely; the Food-tab → Unallocated → `handleAllocate` path is untouched and still works
 *     for staging a dish before a dated list exists. Also added `ungroupedCategoryGroups`
 *     (`groupByCategory` over Monthly's `ungroupedRestItems`) — only resorts into
 *     quiet-captioned clusters when more than one category is actually present; the common
 *     (nobody's categorised anything) case renders flat, unchanged. `handleAddItem` and the
 *     Weekly `onAddInlineItem` callback both now thread an optional `category` through to
 *     `add()`.
 *   - **Tab bar (2026-07-20, shared component)**: the 4-tab switcher's active indicator is
 *     `components/TabBoxHighlight.tsx` — always renders a bordered box behind the label
 *     (white `theme.surface` fill + `theme.border` edge at rest, crossfading to a tinted
 *     `accent` fill + border when active) instead of the old "box only appears when active"
 *     look. Same shared component as app/(tabs)/plans.tsx and app/settings.tsx's tab bars.
 *     Every tab's `accent` in `TAB_META` is the neutral brand `theme.accent` (blue), so the
 *     active-box hue matches Plans, Health's SlideSelector, and the bottom nav — one
 *     consistent "selected" colour app-wide (visual-audit 2026-07-20: Weekly's old green
 *     `theme.good` + Food's meal-domain accent read as a competing selection colour against
 *     the blue nav on the same screen).
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
 *     Reserved sticky height is always `STICKY_HEIGHT_TABS` (tab row only) — the Weekly
 *     summary row under the tabs was removed (debug-note 2026-07-21).
 *   - **A2-1 focused list**: `focusedListId` still picks which non-template list is the
 *     focused one (Decision 017 Q3/Q4), now feeding only WeekListCard's `focused` prop (the
 *     sticky summary row that used to read it is gone). Falls back to the first list when
 *     nothing is explicitly focused yet or the focused list was deleted. WeekListCard's own
 *     compact progress line (non-focused lists only) calls `onFocus` to switch it.
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
 *     advanceRecurringLists(today) (re-loading shopping items after ONLY when it returns
 *     true, i.e. it actually rolled a list forward — a no-op focus skips the reload so the
 *     list doesn't reflow after paint) and the automatic payday-boundary monthly-reset
 *     detection, which now just opens MonthlyResetReviewSheet (resetReviewVisible) instead
 *     of resetting immediately — see that component's header and finalizeMonthlyReset()
 *     below for the actual buildMonthlyResetSummary()/monthlyReset()/lastMonthlyReset
 *     sequence, which now only runs once the user dismisses the sheet (Skip or Confirm),
 *     not at trigger-detection time.
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
import { LayoutAnimation, Modal, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, TextInput, View } from 'react-native';
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
import InlineAddItem from '@/components/InlineAddItem';
import AddDishSheet, { AddDishTarget } from '@/components/AddDishSheet';
import UpdateSheet from '@/components/UpdateSheet';
import MonthlyResetSummaryModal from '@/components/MonthlyResetSummaryModal';
import MonthlyResetReviewSheet from '@/components/MonthlyResetReviewSheet';
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
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TabBoxHighlight from '@/components/TabBoxHighlight';
import { success, heavy, warning } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr, getWeekRangeContaining } from '@/lib/date';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { Fonts, FontSize, Radius, Spacing, Type } from '@/constants/theme';
import { groupByDish, groupByCategory, computeListGroups, listProgress } from '@/lib/shoppingGroups';
import { categoryPresets, categoryLabel } from '@/lib/shoppingCategories';
import { reorderByDrag } from '@/lib/reorder';
import { formatKr } from '@/lib/money';
import { getDomainColor } from '@/lib/domainColor';
import { getScreenColor } from '@/lib/screenColor';

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

// Reserved sticky-bar height — just the tab row now (the focused-list name + progress summary
// row under the tabs was removed 2026-07-21). Matches Plans so the tab→first-card gap is
// consistent across the two list screens.
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


export default function ShoppingScreen() {
  const theme = useAppTheme();
  const t = useT();
  const router = useRouter();
  const { reducedMotion } = useAccessibility();
  const mealDomainColor = getDomainColor(theme, 'meal');

  // Fire the 'shopping_opened' automation trigger once per screen visit (mount).
  // Rules are already loaded by app/_layout.tsx's startup bootstrap.
  useEffect(() => {
    useAutomationStore.getState().fireTrigger('shopping_opened');
  }, []);

  const [tab, setTab] = useState<Tab>('weekly');
  const [hintOpen, setHintOpen] = useFirstVisitHint('shopping');
  // Local edit buffer for the monthly reset-date field embedded in the first-run hint.
  // Starts empty (placeholder-preview per the input UX pass); committing a valid 1–31
  // updates the setting, leaving it blank keeps the current value.
  const [monthlyDateInput, setMonthlyDateInput] = useState('');
  const [focusedListId, setFocusedListId] = useState<string | null>(null);
  // Which target the shared AddDishSheet is pushing into — Monthly's own trigger, or a
  // specific Weekly list's "From a dish" add-chooser option. null = sheet closed.
  const [dishSheetTarget, setDishSheetTarget] = useState<AddDishTarget | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState<(() => void) | null>(null);
  /** Shows a toast; pass `undo` to add an inline "Undo" action (Decision 044a). */
  const setConfirm = useCallback((message: string | null, undo?: () => void) => {
    setConfirmMessage(message);
    setConfirmUndo(() => undo ?? null);
  }, []);
  const [purchasedExpanded, setPurchasedExpanded] = useState<string | null>(null);
  const [resetSummary, setResetSummary] = useState<MonthlyResetSummary | null>(null);
  const [resetReviewVisible, setResetReviewVisible] = useState(false);
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
      // rows directly via the list store, so re-run the shopping load ONLY when it
      // actually created a list — otherwise every focus paid two full-table SQLite
      // scans + a re-render that visibly reflowed the list AFTER the screen painted
      // (focus effects run post-commit). The common case (nothing overdue) now skips it.
      const today = todayStr();
      if (advanceRecurringLists(today)) loadShopping();

      // Automatic payday-boundary reset: once per period, when today's day-of-month
      // has reached monthlyResetDate and we haven't already reset for this period.
      // Read settings via getState() (not a render-time selector) so we see the latest
      // persisted values. Opens the interactive review sheet rather than resetting
      // immediately — lastMonthlyReset is only stamped once the user actually
      // dismisses it (finalizeMonthlyReset), so a backgrounded/killed app with the
      // sheet still open just re-opens it next focus instead of silently skipping
      // the period.
      const periodKey = today.slice(0, 7); // YYYY-MM
      const settings = useSettingsStore.getState();
      const alreadyResetThisPeriod = settings.lastMonthlyReset.slice(0, 7) === periodKey;
      if (!alreadyResetThisPeriod && !resetReviewVisible && new Date().getDate() >= settings.monthlyResetDate) {
        setResetReviewVisible(true);
      }

      return () => {
        setHintOpen(false);
      };
    }, [loadShopping, advanceRecurringLists, resetReviewVisible])
  );

  const catalogItems = useMemo(
    () => items.filter((i) => i.status === 'catalog').sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  // Per-list item counts for MonthlyResetReviewSheet's "N items" meta line.
  const itemCountByListId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of items) {
      if (i.status === 'inWeeklyList' && i.listId) counts[i.listId] = (counts[i.listId] ?? 0) + 1;
    }
    return counts;
  }, [items]);
  const { dishGroups: catalogDishGroups, ungrouped: ungroupedRestItems } = useMemo(
    () => groupByDish(catalogItems),
    [catalogItems]
  );
  // Category clusters for Monthly's ungrouped rows only — Weekly's own ungroupedUnchecked
  // keeps its user-dragged orderIndex order instead (see lib/shoppingGroups.ts note).
  const ungroupedCategoryGroups = useMemo(
    () => groupByCategory(ungroupedRestItems),
    [ungroupedRestItems]
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

  function handleAddItem(input: { name: string; price: number; targetQuantity: number; isTemporary: boolean; category?: string }) {
    add({ name: input.name, amount: '1', unit: '', listType: 'monthly', store: '', price: input.price, inventoryQty: 0, isTemporary: input.isTemporary, targetQuantity: input.targetQuantity, status: 'catalog', category: input.category });
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
    setResetReviewVisible(true);
  }

  /** Finalizes the monthly reset — fired by MonthlyResetReviewSheet's Skip (empty array)
   *  or Confirm (chosen discards). Discards run first so buildMonthlyResetSummary()/
   *  monthlyReset() see final list state, though order doesn't actually matter functionally
   *  since monthlyReset() filters by item status, not list_id. */
  function finalizeMonthlyReset(discardedListIds: string[]) {
    discardedListIds.forEach(removeList);
    setResetSummary(buildMonthlyResetSummary());
    monthlyReset();
    updateSettings({ lastMonthlyReset: todayStr() });
    setResetReviewVisible(false);
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
      // 2. Otherwise, in-section reorder preview (Decision 011 R1). Rebuild the order by pulling
      //    the dragged row out and re-inserting it at the finger's stable insertion index — see
      //    lib/reorder.ts for why this can't oscillate (fixes the old up/down flicker).
      const snapshot = dragSnapshotRef.current;
      let order = prev.order;
      if (Object.keys(snapshot).length) {
        const next = reorderByDrag(centerY, prev.order, itemId, snapshot);
        if (next.some((id, i) => id !== prev.order[i])) {
          if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          order = next;
        }
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

  // Active-tab selection colour is the neutral brand accent (theme.accent) for EVERY tab,
  // so this in-app tab bar's "selected" hue matches Plans, Health's SlideSelector, AND the
  // bottom nav (visual-audit 2026-07-20: Weekly's old green `theme.good` + Food's meal-domain
  // accent read as a second, competing "selected" colour on the same screen as the blue nav).
  // The Weekly cross-tab tick cue below stays `theme.good` — that's a status confirmation,
  // not the selection colour.
  const TAB_META: { value: Tab; label: string; accent: string; count: number }[] = [
    { value: 'weekly', label: t.weeklyTabLabel, accent: theme.accent, count: ukelisteBadge },
    { value: 'monthly', label: t.monthlyTabLabel, accent: theme.accent, count: 0 },
    { value: 'food', label: t.foodTabLabel, accent: theme.accent, count: 0 },
    { value: 'catalogue', label: t.catalogueTabLabel, accent: theme.accent, count: 0 },
  ];

  // Sticky strip is now just the tab row (debug-note 2026-07-21: the date + amount summary
  // row under the tabs was removed), so it always reserves the tab-only height.
  const stickyHeight = STICKY_HEIGHT_TABS;
  const stickyBelowHeader = (
    // Frosted-glass strip (same overlay Surface as the header): the ambient background reads
    // softly through the frost AROUND the opaque tab chips, and content scrolling behind the
    // sticky strip blurs instead of showing through raw (2026-07-20). borderRadius:0 = edge-to-edge.
    <Surface surfaceContext="overlay" style={[styles.stickyBar, styles.stickyGlass]}>
      <View style={styles.tabsRow}>
        {TAB_META.map(({ value, label, accent, count }) => {
          const isActive = tab === value;
          return (
            <PressableScale
              key={value}
              style={styles.tab}
              onPress={() => setTab(value)}
              accessibilityRole="button"
              accessibilityLabel={label}
              scaleTo={0.97}
            >
              <TabBoxHighlight active={isActive} accent={accent} />
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

      {/* The focused-list name + live-progress summary row under the tabs was removed
          (debug-note 2026-07-21) — the per-list card already carries its own name and
          progress, so the sticky strip is now just the tab row. */}
    </Surface>
  );

  // Screen intro chrome (first-run hint + incoming shared requests), shared by every tab.
  // Extracted so the Catalogue tab — which renders its own FlatList outside the padded
  // content View (scrollable={false}) — can hand it in as that list's header and keep it
  // scrolling with the rows.
  const shoppingIntro = (
    <>
      <PressableScale
        style={[styles.budgetPill, { borderColor: theme.featBudget }]}
        onPress={() => router.push('/budget')}
        accessibilityRole="button"
        accessibilityLabel={t.budget.title}
        hitSlop={6}
        scaleTo={0.97}
      >
        <Ionicons name="wallet-outline" size={14} color={theme.featBudget} />
        <Text style={[styles.budgetPillText, { color: theme.featBudget }]}>{t.budget.title}</Text>
      </PressableScale>

      <HintCard text={t.hints.shopping.text} open={hintOpen} noPill>
        <View style={[styles.hintSetting, { borderTopColor: theme.hintBorder }]}>
          <Text style={[styles.hintSettingLabel, { color: theme.text }]}>{t.weeklyResetDay}</Text>
          <View style={styles.hintDayRow}>
            {t.dayFull.map((label, i) => (
              <PressableScale
                key={i}
                style={[
                  styles.hintDayChip,
                  { backgroundColor: theme.surfaceMuted },
                  weeklyResetDay === i && { backgroundColor: theme.accent },
                ]}
                onPress={() => updateSettings({ weeklyResetDay: i })}
                scaleTo={0.97}
              >
                <Text style={[
                  styles.hintDayText,
                  { color: theme.text },
                  weeklyResetDay === i && { color: theme.accentInk },
                ]}>
                  {label.slice(0, 3)}
                </Text>
              </PressableScale>
            ))}
          </View>
          <Text style={[styles.hintSettingLabel, { color: theme.text, marginTop: Spacing.sm }]}>{t.monthlyResetDateQuestion}</Text>
          <TextInput
            style={[styles.hintDateInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
            value={monthlyDateInput}
            onChangeText={(v) => {
              setMonthlyDateInput(v);
              const n = parseInt(v, 10);
              if (!isNaN(n) && n >= 1 && n <= 31) updateSettings({ monthlyResetDate: n });
            }}
            onBlur={() => setMonthlyDateInput('')}
            keyboardType="number-pad"
            placeholder={String(monthlyResetDate)}
            placeholderTextColor={theme.textMuted}
            maxLength={2}
            returnKeyType="done"
          />
        </View>
      </HintCard>
      <SharedRequestsSection kind="shopping" />
    </>
  );

  return (
    <>
    <ScreenScaffold title={t.shoppingTitle} tier="site" bottomNav={false} ownBackground={false} screenColor={getScreenColor(theme, 'shopping').base} scrollable={tab !== 'catalogue'} stickyBelowHeader={stickyBelowHeader} stickyBelowHeaderHeight={stickyHeight} infoActive={hintOpen} onInfoToggle={() => setHintOpen((v) => !v)} onScroll={handleScreenScroll}>
      {tab === 'catalogue' ? (
        <CatalogueTab onNotify={setConfirm} header={shoppingIntro} />
      ) : (
      // Debug notes: one anchor for the whole list region (all non-catalogue tabs). Don't
      // also wrap the inner cards/rows — one DebugNoteAnchor per region (no nesting).
      <DebugNoteAnchor id="shopping.list" label="Shopping — List" style={styles.content}>
        {shoppingIntro}

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
                  <Ionicons name="refresh-circle" size={32} color={theme.bad} />
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
                      // More than one category present → cluster with a quiet caption divider
                      // per category; otherwise (the common case — nobody's categorised
                      // anything yet) render flat, same as before, with no extra chrome.
                      ungroupedCategoryGroups.length > 1 ? (
                        ungroupedCategoryGroups.map(([catKey, catItems]) => (
                          <View key={catKey}>
                            <Text style={[styles.categoryClusterLabel, { color: theme.textMuted }]}>
                              {categoryLabel(t, catKey)}
                            </Text>
                            <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                              {catItems.map((item, idx) => (
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
                                  {idx < catItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                                </View>
                              ))}
                            </View>
                          </View>
                        ))
                      ) : (
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
                      )
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
                  <>
                    {/* "+ Add item" collapses to a bar and expands into the full add form IN
                        PLACE (no modal) — the multi-field counterpart to components/AddRow, so
                        adding to Monthly uses the same "+ makes a new row, with Add/Discard"
                        affordance as everywhere else. Replaced the AddItemSheet modal
                        (2026-07-19). */}
                    <InlineAddItem
                      label={t.catalogueAddNewBtn}
                      onAdd={handleAddItem}
                      categories={categoryPresets(t)}
                      style={styles.addItemSpacing}
                    />
                    {/* Add a whole dish (its ingredients) to the Monthly list in place — the
                        in-tab counterpart to the Food tab's "Add to monthly list", so meals can
                        be planned for the month without leaving this tab. */}
                    <PressableScale
                      style={[styles.addTrigger, styles.addItemSpacing, { borderColor: theme.accent }]}
                      onPress={() => setDishSheetTarget({ mode: 'monthly' })}
                      accessibilityRole="button"
                      accessibilityLabel={t.addDishBtn}
                      scaleTo={0.97}
                    >
                      <Ionicons name="restaurant-outline" size={16} color={theme.accent} />
                      <Text style={[styles.addTriggerText, { color: theme.accent }]}>{t.addDishBtn}</Text>
                    </PressableScale>
                  </>
                )}
              </View>

              {purchasedByTrip.length > 0 && (
                <View style={styles.section}>
                  <View style={[styles.sectionTitleCard, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.purchasedThisMonthSection}</Text>
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
                      category: input.category,
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
                  onOpenDishSheet={() => setDishSheetTarget({ mode: 'weekly', listId: list.id })}
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
              // Neutral edge (theme.border) instead of the default screen-hue edge, so this
              // empty placeholder reads as a quiet "nothing here yet", not a coded surface
              // (2026-07-20 unify placeholder cards).
              <Surface style={styles.weekEmptyCard} borderColor={theme.border}>
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

        {/* Catalogue renders above (scrollable={false} branch) as its own virtualising
            FlatList — it is NOT one of the content-View tabs. */}
      </DebugNoteAnchor>
      )}

      <AddDishSheet
        visible={dishSheetTarget !== null}
        onClose={() => setDishSheetTarget(null)}
        onAdded={(dishName) =>
          setConfirm(dishSheetTarget?.mode === 'weekly' ? t.dishAddedToWeek(dishName) : t.dishAddedToMonthly(dishName))
        }
        target={dishSheetTarget ?? { mode: 'monthly' }}
      />

      <UpdateSheet visible={updateItem !== null} item={updateItem} onClose={() => setUpdateItem(null)} onSave={handleUpdateSave} onDelete={handleUpdateDelete} />

      <MonthlyResetReviewSheet
        visible={resetReviewVisible}
        lists={nonTemplateLists}
        itemCountByListId={itemCountByListId}
        catalogItems={catalogItems}
        onReorderLists={(order) => order.forEach((id, i) => useShoppingListStore.getState().update(id, { sortOrder: i }))}
        onSetInventoryQty={(id, qty) => update(id, { inventoryQty: qty })}
        onFinalize={finalizeMonthlyReset}
      />
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
  // Embedded first-run setting inside the ⓘ hint (weekly/monthly reset).
  hintSetting: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  hintSettingLabel: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  hintDayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  hintDayChip: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: Radius.full,
  },
  hintDayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  hintDateInput: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    textAlign: 'center',
    alignSelf: 'flex-start',
    minWidth: 64,
  },
  // Decision 043 rule 2: Spacing.xl above each of the Monthly tab's two named sections.
  bodyGap: { gap: Spacing.xl },
  dishGroupsWrap: { gap: Spacing.xs },

  stickyBar: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.xs, gap: 2 },
  // Edge-to-edge frosted strip (Surface overlay) — square corners, no floating-card rounding.
  stickyGlass: { borderRadius: 0 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // flexGrow without a pinned flexBasis (2026-07-20: was `flex: 1`, i.e. flexBasis:0 — an equal
  // 4-way split regardless of label length, which clipped the longer Norwegian "Månedsliste" to
  // "Månedsli…"). flexBasis defaults to each box's own content width (label + padding), so a
  // longer label gets a wider box; flexGrow still divides any leftover row width across all four.
  tab: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  // Bumped from Type.label.size (14) — read as too small once the tab got a visible
  // rounded frame around it (2026-07-19 visual-audit). includeFontPadding/textAlignVertical
  // fix Android's Nunito vertical-centering offset inside the line box (same fix as
  // ScreenHeader.tsx's title — see HEADER_CLIP_DEBUG.md).
  tabText: {
    fontFamily: Type.label.fontFamily,
    fontSize: FontSize.md,
    lineHeight: Math.round(FontSize.md * Type.label.line),
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  tabBadge: { minWidth: 18, height: 18, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontFamily: Fonts.bold },
  tabCue: { width: 16, height: 16, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },

  catalogCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catalogHeaderTitle: { fontFamily: Type.heading.fontFamily, fontSize: Type.heading.size },
  catalogHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Budget entry point (moved here from app/(tabs)/scan.tsx, 2026-07-19 — Budget is only
  // reachable via Shopping now). Bordered pill, same family as addTrigger below, right-aligned
  // above the shared intro chrome so it's visible on every tab.
  budgetPill: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  budgetPillText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
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
  addTriggerText: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  addItemSpacing: { marginTop: Spacing.sm },
  resetIconBtn: { alignItems: 'center', justifyContent: 'center' },

  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  dialogBox: { borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 340, gap: Spacing.lg },
  dialogMessage: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size, textAlign: 'center' },
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
  unsavedBannerText: { flex: 1, fontFamily: Type.label.fontFamily, fontSize: Type.label.size },

  // Weekly "Unallocated" card
  unallocatedCard: { borderRadius: Radius.md },
  unallocatedCardRow: { flexDirection: 'row' },
  unallocatedAccent: { width: 4, alignSelf: 'stretch' },
  unallocatedContent: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  unallocatedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  unallocatedTitle: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
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
  // Quiet category-cluster caption (Monthly's ungrouped rows only) — lighter-weight than
  // sectionHeaderRow's bordered/backgrounded treatment, just a small label above each cluster.
  categoryClusterLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: Spacing.xs,
  },
  // Pill background so the per-trip disclosure toggle stays legible over busy backgrounds
  // (Decision 043 rule 2's fixed anatomy — Fonts.semibold/FontSize.lg — is only for the
  // section title itself, sectionLabel below; this row is a repeatable foldout control).
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  sectionLabel: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  // Visual-audit 2026-07-11: gives Monthly-tab section titles the same surfaceMuted-card
  // treatment plans.tsx's sectionHeader() already applies — was bare text, flat/low-contrast
  // against the particle background.
  sectionTitleCard: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, marginBottom: Spacing.sm },

  disclosureChevron: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  weekLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

  weekEmptyCard: { borderRadius: Radius.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md },
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
  newListTriggerText: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
});
