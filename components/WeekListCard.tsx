/**
 * WeekListCard.tsx — one per-list container per weekly ShoppingList row.
 *
 * Simplified layout (2026-07-06 redesign): three clean sections — In list
 * (all unchecked items, ungrouped and dish-grouped flattened together, plus a shared
 * components/InlineAddItem add row when unlocked), In cart (all checked items),
 * Purchased (completed trip items for this list, collapsed). "Add from monthly" opens
 * components/AddFromMonthlyModal as a centered popup (2026-07-22 — replaced the old
 * inline in-card panel; see that component's header). A components/ShoppingFilterBar
 * (name search + category dropdown) sits above In list/In cart — when active it flattens
 * both sections into plain filtered ShoppingRows (no drag reorder); inactive, everything
 * renders exactly as before. Each section shows a price total footer. Dish groups are no
 * longer rendered as nested ExpandableCards; all items are flat rows.
 *
 * Connections:
 *   Imports → components/AddFromMonthlyModal, components/AppModal (showAppModal),
 *             components/Collapsible, components/ExpandableCard,
 *             components/FlightOverlay (FlightRect type only),
 *             components/IconButton, components/InlineAddItem, components/ShoppingFilterBar,
 *             components/Surface, components/ShoppingRow (CHECKED_OPACITY), constants/theme,
 *             lib/i18n, lib/money (formatKr), lib/shoppingCategories (categoryPresets),
 *             lib/shoppingGroups (listProgress, listTotal), lib/useAppTheme, lib/haptics,
 *             lib/domainColor, store/useShoppingListStore (ShoppingList type),
 *             store/useShoppingStore (ShoppingItem type), store/useMonthlyListStore (MonthlyList type)
 *   Used by → app/shopping.tsx
 *   Data    → none directly — every item/group/callback is owned by the parent
 *
 * Edit notes:
 *   - **Saved-lists sync-back (2026-07-22)**: `openListOptions`'s kebab menu gains a "Sync
 *     to saved list" entry (`onSyncToTemplate`) whenever `list.sourceTemplateId` is set —
 *     i.e. this list was instantiated from a saved list via components/SavedListsSection.tsx
 *     (drag or tap-to-choose-week) or the older SavedListsModal popup. The parent
 *     (app/shopping.tsx's `handleSyncListToTemplate`) owns the actual overwrite.
 *   - **2026-07-22 redesign pass (Shopping screen redesign)**: card is now collapsed by
 *     default — the whole body (below the header row) is wrapped in `Collapsible`, driven
 *     by the parent-owned `expanded`/`onToggleExpand` props (lifted, not local state, so
 *     shopping.tsx's cross-week drag can gate on it the same way DraggableTaskRow already
 *     gates item-row dragging on "not open"). The Planning/Shopping mode pill is gone —
 *     the lock icon (`lock-closed`/`lock-open-outline`, same convention as the Monthly tab's
 *     catalog lock) toggles lock state directly via `onToggleLock`; the card edge is always
 *     the shop-green domain accent now (no more amber-while-unlocked). New `dirty` prop
 *     (parent diffs live state against a snapshot captured at unlock) shows Save/Discard
 *     icon buttons beside the lock icon while true (`onSaveChanges`/`onDiscardChanges`) —
 *     the old always-visible "Plan mode active" status bar is gone; locking while dirty is
 *     the parent's job (`onToggleLock` may itself prompt before actually toggling — see
 *     shopping.tsx's `requestLock`). The name field is now tap-to-edit: a non-custom-named
 *     list shows a muted "Shopping list" preview (`t.shoppingListPlaceholder`) instead of
 *     the auto date-range text; tapping swaps it for an autoFocused TextInput (`nameEditing`
 *     state) — the underlying auto date-range name is unchanged, it just isn't shown as the
 *     default header text anymore.
 *   - **2026-07-22 popup + filter pass**: "Add from monthly" now pops a centered
 *     `AddFromMonthlyModal` (checkbox multi-select, batch commit via "Add (n)") instead of
 *     swapping an inline panel into the card — see that component's own header for the
 *     batch-add/no-rollback rationale. The old `monthlySessionAdds`/`handleCancelMonthly`
 *     undo-by-name tracking is gone along with it (nothing is added until the modal's Add
 *     button fires, so Cancel needs no rollback). `onAddMonthlyToWeek` (per-item prop) was
 *     replaced by `onAddMonthlyItemsToWeek` (batch prop) — shopping.tsx now loops the store
 *     call and shows one consolidated toast instead of one per item. Also added
 *     `ShoppingFilterBar` (`listSearch`/`listCategory` state) above In list — category was
 *     previously a display-only tag (`ShoppingRow`'s tag, `groupByCategory` on Monthly); this
 *     is the first place it actually filters/searches the Weekly list.
 *   - **2026-07-20 shopping-cleanup pass**: replaced the previous hand-rolled inline add row
 *     (own TextInput + catalog-search dropdown + qty stepper, duplicating InlineAddItem) with
 *     the shared `components/InlineAddItem` — same form Monthly and inventory-edit use, so
 *     Weekly no longer maintains a second, differently-styled add form. Also replaced the
 *     3-icon header row (bookmark/settings/trash) with one kebab (`ellipsis-vertical`) opening
 *     a `showAppModal` chooser (`openListOptions`).
 *   - **2026-07-21 add-paths pass**: the two secondary add paths are now visible buttons below
 *     the primary add bar (`addOptionsRow`), replacing the earlier hidden "more ways to add…"
 *     text link + `showAppModal` chooser (felt unnatural). "From monthly" opens the
 *     `AddFromMonthlyModal` popup (`setMonthlyPreviewOpen`, since 2026-07-22 no longer an
 *     inline panel — see the note above); "From a dish" calls the `onOpenDishSheet` prop up to
 *     shopping.tsx, which opens the shared `AddDishSheet` targeted at this list's id — lands
 *     ingredients directly in this list, skipping the Unallocated bucket. The primary "+" add
 *     bar (`InlineAddItem`) stays the visual primary.
 *   - 2026-07-06 redesign: removed AddDivider + lock icon. Replaced with inline add row
 *     (TextInput + catalog search dropdown + qty controls + price total, visible only
 *     when unlocked) and a mode-toggle pill button ("Shopping" locked / "Planning" unlocked).
 *   - **2026-07-18 planned/made colour coding**: the card name is an always-editable
 *     TextInput header (no more tap-to-reveal `editing` state). The card edge + mode pill
 *     are colour-keyed to lock state — amber (`theme.warn`) "Planning"/planned while
 *     unlocked, green (`getDomainColor(theme,'shop').accent`) "Shopping"/made once locked.
 *     (2026-07-18: the extra green `getGlow()` halo + its wrapper View were removed — glossy
 *     halos read as the plastic "toy tile" look; the edge colour alone carries the state.) The
 *     items sub-label is dropped in planning (the name header is enough) and reads
 *     "To buy (n)" (`t.toBuySection`) in shopping.
 *   - `dishGroups` prop is kept so this card can flatten dish items into the right section
 *     buckets without the parent having to recompute.
 *   - `renderReorderableRow` is still used for ungroupedUnchecked items only (drag reorder).
 *     Dish-grouped unchecked items render as plain ShoppingRow (no drag wrapper).
 *   - listProgress() is still called here for the compact progress line on non-focused lists
 *     and the "Shopping done!" disabled state — same helper, same data.
 *   - Outer card border is `getDomainColor(theme,'shop').accent` (Surface's `borderColor` prop,
 *     2026-07-14), matching Home's preview-card treatment so the card reads as the same
 *     object when tapping through from Home into full Shopping.
 *   - **Decision 044b (2026-07-09):** entrance/highlight animation for just-added rows is
 *     handled by ShoppingRow reading recentlyAddedIds directly from useShoppingStore — no
 *     prop threading needed through WeekListCard.
 *   - **Flight animation (Phase 1, 2026-07-11)**: `registerCartHeaderNode` hands the "In
 *     cart" section header's native node up to shopping.tsx (mirrors the existing
 *     `registerDishGroupNode` cross-component registration idiom used for drag-to-merge)
 *     so it can be measured as a flight destination. `onFlightStart` forwards a measured
 *     source rect for dish-grouped "In list" rows only — ungroupedUnchecked rows are wired
 *     directly at the shopping.tsx call site via `renderReorderableRow`, not through this
 *     component. This component owns no flight state, same as every other mutation
 *     callback here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ShoppingList } from '@/store/useShoppingListStore';
import { ShoppingItem } from '@/store/useShoppingStore';
import { MonthlyList } from '@/store/useMonthlyListStore';
import { Fonts, FontSize, Radius, Spacing, Type } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { listProgress } from '@/lib/shoppingGroups';
import { formatKr } from '@/lib/money';
import { categoryPresets } from '@/lib/shoppingCategories';
import Surface from '@/components/Surface';
import IconButton from '@/components/IconButton';
import ExpandableCard from '@/components/ExpandableCard';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import ShoppingRow, { CHECKED_OPACITY } from '@/components/ShoppingRow';
import InlineAddItem from '@/components/InlineAddItem';
import AddFromMonthlyModal from '@/components/AddFromMonthlyModal';
import ShoppingFilterBar from '@/components/ShoppingFilterBar';
import { showAppModal } from '@/components/AppModal';
import type { FlightRect } from '@/components/FlightOverlay';
import { getDomainColor } from '@/lib/domainColor';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  list: ShoppingList;
  focused: boolean;
  onFocus: () => void;
  dishGroups: [string, ShoppingItem[]][];
  ungroupedUnchecked: ShoppingItem[];
  checked: ShoppingItem[];
  /** Items with status='purchased' for this list (completed trips). */
  purchased: ShoppingItem[];
  /** Collapsed by default (Decision 2026-07-22) — parent owns this so the screen-level
   *  week-drag can gate on it (a card is only draggable between week sections while
   *  collapsed, matching DraggableTaskRow's existing "no drag while open" convention). */
  expanded: boolean;
  onToggleExpand: () => void;
  /** True once this list's live state differs from the snapshot captured at unlock —
   *  parent owns the snapshot/diff (app/(tabs)/shopping.tsx), this only renders the
   *  Save/Discard affordance when true. */
  dirty: boolean;
  onSaveChanges: () => void;
  onDiscardChanges: () => void;
  /** Pressing the lock icon — parent decides whether to lock straight away or, if
   *  `dirty`, prompt to save/discard first (see shopping.tsx's requestLock). */
  onToggleLock: () => void;
  onRename: (name: string) => void;
  onOpenSavedLists: () => void;
  onOpenListSettings: () => void;
  onDelete: () => void;
  /** Pushes this list's current items back to its source saved list (only meaningful,
   *  and only shown in the kebab menu, when list.sourceTemplateId is set). */
  onSyncToTemplate: () => void;
  onToggleItem: (item: ShoppingItem) => void;
  onRemoveItem: (item: ShoppingItem) => void;
  onIncrementItem: (item: ShoppingItem) => void;
  onDecrementItem: (item: ShoppingItem) => void;
  /** Inline add row submission — called when the user confirms adding a new item. */
  onAddInlineItem: (input: { name: string; price: number; qty: number; category?: string }) => void;
  /** Decrement a cart item — at qty=1 moves it back to "In list"; at qty>1 splits one unit back. */
  onDecrementCartItem: (item: ShoppingItem) => void;
  /** The curated monthly-list items (status 'catalog', across every Monthly list) shown in
   *  the "add from monthly" popup. */
  monthlyItems: ShoppingItem[];
  /** Every Monthly list, in display order — AddFromMonthlyModal sections monthlyItems under
   *  each one's name header (Shopping/Monthly redesign, 2026-07-22). */
  monthlyLists: MonthlyList[];
  /** Move a batch of monthly-list items into this week list in one go (parent loops
   *  addToWeeklyFromCatalog and shows a single consolidated toast). */
  onAddMonthlyItemsToWeek: (items: ShoppingItem[]) => void;
  onDoneShopping: () => void;
  /** Opens the shared AddDishSheet targeted at this list (parent sets dishSheetTarget). */
  onOpenDishSheet: () => void;
  /** Renders one reorderable "In list" ungrouped row — parent wraps it in DraggableTaskRow. */
  renderReorderableRow: (item: ShoppingItem, index: number, total: number) => React.ReactNode;
  /** Hands the "In cart" section header's native node up so the screen can measureInWindow()
   *  it as a flight destination. React calls this with null when the section unmounts. */
  registerCartHeaderNode?: (node: any) => void;
  /** Bubbles a measured flight source rect for a dish-grouped "In list" row up to the screen. */
  onFlightStart?: (item: ShoppingItem, rect: FlightRect) => void;
};

/** Price × amount total for a set of items. */
function calcSectionTotal(items: ShoppingItem[]): number {
  return items.reduce((sum, i) => sum + i.price * (parseInt(i.amount, 10) || 1), 0);
}

export default function WeekListCard({
  list,
  focused,
  onFocus,
  dishGroups,
  ungroupedUnchecked,
  checked,
  purchased,
  expanded,
  onToggleExpand,
  dirty,
  onSaveChanges,
  onDiscardChanges,
  onToggleLock,
  onRename,
  onOpenSavedLists,
  onOpenListSettings,
  onDelete,
  onSyncToTemplate,
  onToggleItem,
  onRemoveItem,
  onIncrementItem,
  onDecrementItem,
  onAddInlineItem,
  onDecrementCartItem,
  monthlyItems,
  monthlyLists,
  onAddMonthlyItemsToWeek,
  onDoneShopping,
  onOpenDishSheet,
  renderReorderableRow,
  registerCartHeaderNode,
  onFlightStart,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'shop');
  const t = useT();
  // Tap-to-edit name field (2026-07-22): a non-custom-named list shows a muted "Shopping
  // list" preview instead of the auto date-range text; tapping it swaps the preview Text
  // for an autoFocused TextInput (preview "disappears", box is "selected"). A custom-named
  // list shows its real name as the (still tappable) preview instead.
  const [nameEditing, setNameEditing] = useState(false);
  const [nameInput, setNameInput] = useState(list.isCustomName ? list.name : '');
  const [monthlyPreviewOpen, setMonthlyPreviewOpen] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listCategory, setListCategory] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(list.isCustomName ? list.name : '');
    setNameEditing(false);
  }, [list.id, list.name, list.isCustomName]);

  function startNameEdit() {
    setNameEditing(true);
  }

  useEffect(() => {
    if (list.locked) {
      setMonthlyPreviewOpen(false);
      setListSearch('');
      setListCategory(null);
    }
  }, [list.locked]);

  function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== list.name) onRename(trimmed);
    else if (!trimmed) setNameInput(list.isCustomName ? list.name : ''); // falls back to the preview placeholder
    setNameEditing(false);
  }

  // Kebab menu (Saved lists / List settings / Delete) — replaces 3 separately-visible
  // IconButtons with one entry point, reusing the app's existing showAppModal chooser.
  function openListOptions() {
    showAppModal(list.name, undefined, [
      { text: t.savedListsButtonLabel, onPress: onOpenSavedLists },
      // Only offered once this list was itself instantiated from a saved list — nothing
      // to sync back for a list that was started empty.
      ...(list.sourceTemplateId ? [{ text: t.syncListButtonLabel, onPress: onSyncToTemplate }] : []),
      { text: t.listSettingsButtonLabel, onPress: onOpenListSettings },
      { text: t.deleteListButtonLabel, style: 'destructive' as const, onPress: onDelete },
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  // Flatten dish-grouped items into the appropriate section buckets.
  const dishUnchecked = useMemo(
    () => dishGroups.flatMap(([, items]) => items.filter((i) => !i.checked)),
    [dishGroups]
  );
  const dishChecked = useMemo(
    () => dishGroups.flatMap(([, items]) => items.filter((i) => i.checked)),
    [dishGroups]
  );
  const allChecked = useMemo(() => [...checked, ...dishChecked], [checked, dishChecked]);

  const progress = listProgress({ dishGroups, ungroupedUnchecked, checked });
  const inListTotal = calcSectionTotal([...ungroupedUnchecked, ...dishUnchecked]);
  const inCartTotal = calcSectionTotal(allChecked);
  const purchasedTotal = calcSectionTotal(purchased);

  // Real name+category filter (Decision: category becomes an actual filter, not just a
  // display tag) — inactive (empty search, no category picked) renders exactly as before,
  // drag-reorder intact. Active flattens "In list"/"In cart" into plain filtered rows.
  const filterActive = listSearch.trim().length > 0 || listCategory !== null;
  const matchesFilter = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return (item: ShoppingItem) =>
      (!q || item.name.toLowerCase().includes(q)) && (listCategory == null || item.category === listCategory);
  }, [listSearch, listCategory]);
  const filteredInList = useMemo(
    () => (filterActive ? [...ungroupedUnchecked, ...dishUnchecked].filter(matchesFilter) : []),
    [filterActive, ungroupedUnchecked, dishUnchecked, matchesFilter]
  );
  const filteredInCart = useMemo(
    () => (filterActive ? allChecked.filter(matchesFilter) : []),
    [filterActive, allChecked, matchesFilter]
  );

  const totalInList = ungroupedUnchecked.length + dishUnchecked.length;
  const totalInCart = allChecked.length;
  const showInListSection = totalInList > 0 || !list.locked;

  // Card edge is always the shopping-green domain accent now (2026-07-22) — the old
  // amber-while-unlocked/green-while-locked coding read as "not appealing" and was
  // dropped; lock state is carried entirely by the lock icon + Save/Discard buttons below.
  const edgeColor = domainColor.accent;

  return (
    <Surface borderColor={edgeColor} style={styles.cardRow}>
      <View style={styles.cardContent}>
      {/* ── Card header: tap-to-edit name + expand/collapse + save/discard/lock/settings ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Tap-to-edit name (2026-07-22): a non-custom list shows a muted "Shopping list"
              preview (not the auto date-range text); tapping swaps it for an autoFocused
              TextInput. A custom-named list previews its real name, still tappable to rename. */}
          <View style={styles.nameWrap}>
            {nameEditing ? (
              <TextInput
                style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t.shoppingListPlaceholder}
                placeholderTextColor={theme.textMuted}
                onSubmitEditing={commitRename}
                onBlur={commitRename}
                returnKeyType="done"
                autoFocus
              />
            ) : (
              <PressableScale onPress={startNameEdit} style={styles.namePreviewBtn} scaleTo={0.98}>
                <Text
                  style={[styles.namePreviewText, { color: list.isCustomName ? theme.text : theme.textMuted }]}
                  numberOfLines={1}
                >
                  {list.isCustomName ? list.name : t.shoppingListPlaceholder}
                </Text>
              </PressableScale>
            )}
            {list.isRecurring && (
              <IconButton
                icon="repeat"
                label={t.listRecurringToggleLabel}
                onPress={onOpenListSettings}
                size={18}
                tint="transparent"
                color={theme.good}
                style={styles.repeatIcon}
              />
            )}
          </View>

          <View style={styles.iconRow}>
            {/* Save/Discard (2026-07-22) — only shown once this list's draft actually
                differs from its last-locked snapshot (parent-computed `dirty`). Replaces
                the old always-visible Planning/Shopping mode pill. */}
            {dirty && (
              <>
                <IconButton icon="checkmark-circle-outline" label={t.listSaveButtonLabel} onPress={onSaveChanges} color={theme.good} size={30} />
                <IconButton icon="arrow-undo-outline" label={t.listDiscardButtonLabel} onPress={onDiscardChanges} color={theme.bad} size={30} />
              </>
            )}
            <IconButton
              icon={list.locked ? 'lock-closed' : 'lock-open-outline'}
              label={list.locked ? t.unlockListButtonLabel : t.lockListButtonLabel}
              onPress={onToggleLock}
              active={list.locked}
              size={30}
            />
            <IconButton icon="ellipsis-vertical" label={t.listOptionsButtonLabel} onPress={openListOptions} size={30} />
            <IconButton
              icon={expanded ? 'chevron-up' : 'chevron-down'}
              label={expanded ? t.collapseListLabel : t.expandListLabel}
              onPress={onToggleExpand}
              size={30}
            />
          </View>
        </View>

        {!expanded && progress.total > 0 && (
          <PressableScale onPress={onFocus} style={styles.compactProgressRow} scaleTo={0.97}>
            <Text style={[styles.compactProgressText, { color: theme.textMuted }]}>
              {t.shoppingRemaining(progress.remaining, progress.inCart)}
            </Text>
          </PressableScale>
        )}
      </View>

      <Collapsible open={expanded}>
      <View style={styles.bodyGap}>
        {progress.total === 0 && list.locked && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.weeklyEmptyTitle}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>{t.weeklyEmptySubtitle}</Text>
          </View>
        )}

        {/* ── Items section — labelled "To buy" only while shopping; in planning the
            card header names the list, so no redundant sub-label. ── */}
        {showInListSection && (
          <View style={styles.section}>
            {list.locked && (
              <View style={[styles.sectionHeaderRow, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.sectionLabel, { color: theme.good }]}>{t.toBuySection(totalInList)}</Text>
                <View style={[styles.sectionRule, { backgroundColor: theme.good }]} />
              </View>
            )}

            {(totalInList > 0 || totalInCart > 0) && (
              <ShoppingFilterBar
                search={listSearch}
                onSearchChange={setListSearch}
                category={listCategory}
                onCategoryChange={setListCategory}
                placeholder={t.weeklyListSearchPlaceholder}
              />
            )}

            {filterActive ? (
              filteredInList.length > 0 && (
                <View style={[styles.rowsCard, { backgroundColor: theme.surface, borderLeftColor: theme.good }]}>
                  {filteredInList.map((item, idx) => (
                    <View key={item.id}>
                      <ShoppingRow
                        item={item}
                        variant="planned"
                        onToggle={() => onToggleItem(item)}
                        onRemove={() => onRemoveItem(item)}
                        onIncrement={() => onIncrementItem(item)}
                        onDecrement={() => onDecrementItem(item)}
                        inStockLabel={t.inStockLabel}
                        locked={list.locked}
                        onFlightStart={(rect) => onFlightStart?.(item, rect)}
                      />
                      {idx < filteredInList.length - 1 && (
                        <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  ))}
                </View>
              )
            ) : (
              (ungroupedUnchecked.length > 0 || dishUnchecked.length > 0) && (
                <View style={[styles.rowsCard, { backgroundColor: theme.surface, borderLeftColor: theme.good }]}>
                  {ungroupedUnchecked.map((item, idx) => (
                    <View key={item.id}>
                      {renderReorderableRow(item, idx, ungroupedUnchecked.length)}
                      {(idx < ungroupedUnchecked.length - 1 || dishUnchecked.length > 0) && (
                        <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  ))}
                  {dishUnchecked.map((item, idx) => (
                    <View key={item.id}>
                      <ShoppingRow
                        item={item}
                        variant="planned"
                        onToggle={() => onToggleItem(item)}
                        onRemove={() => onRemoveItem(item)}
                        onIncrement={() => onIncrementItem(item)}
                        onDecrement={() => onDecrementItem(item)}
                        inStockLabel={t.inStockLabel}
                        locked={list.locked}
                        onFlightStart={(rect) => onFlightStart?.(item, rect)}
                      />
                      {idx < dishUnchecked.length - 1 && (
                        <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  ))}
                </View>
              )
            )}

            {/* Inline add row — only shown when unlocked (planning mode), as its own
                element below the rows list (matching how the Monthly tab places its
                InlineAddItem, rather than nested inside the bordered rows box). Shared
                components/InlineAddItem (same "+ makes a new row" idiom as the Monthly tab
                and inventory-edit) replaces the previous hand-rolled add row so Weekly and
                Monthly no longer maintain two differently-styled add forms. */}
            {!list.locked && (
              <InlineAddItem
                label={t.addItemInputPlaceholder}
                accent={theme.good}
                showTemporaryToggle={false}
                categories={categoryPresets(t)}
                quantityLabel={t.onsketAntallWeeklyLabel}
                onAdd={({ name, price, targetQuantity, category }) =>
                  onAddInlineItem({ name, price, qty: targetQuantity, category })
                }
              />
            )}

            {/* The two secondary add paths as visible buttons (debug-note 2026-07-21) — a
                hidden "more ways to add…" link that opened an action sheet felt unnatural, so
                "From monthly" / "From a dish" now sit in plain sight below the primary add bar,
                styled as quiet secondary buttons so the inline add stays the visual primary. */}
            {!list.locked && (
              <View style={styles.addOptionsRow}>
                <PressableScale
                  style={[styles.addOptionBtn, { borderColor: theme.border }]}
                  onPress={() => setMonthlyPreviewOpen(true)}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={t.addFromMonthlyOption}
                >
                  <Ionicons name="repeat-outline" size={15} color={theme.good} />
                  <Text style={[styles.addOptionText, { color: theme.text }]} numberOfLines={1}>{t.addFromMonthlyOption}</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.addOptionBtn, { borderColor: theme.border }]}
                  onPress={onOpenDishSheet}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={t.addFromDishOption}
                >
                  <Ionicons name="restaurant-outline" size={15} color={theme.good} />
                  <Text style={[styles.addOptionText, { color: theme.text }]} numberOfLines={1}>{t.addFromDishOption}</Text>
                </PressableScale>
              </View>
            )}

            {/* "Add from monthly" now pops out as a centered modal (see AddFromMonthlyModal)
                instead of an inline in-card panel — the user scrolls the whole monthly list
                and checks off items, committing them all in one batch via its "Add (n)"
                button. Nothing lands in the weekly list until that button is pressed, so
                there's no undo/rollback needed here on cancel. */}
            <AddFromMonthlyModal
              visible={monthlyPreviewOpen}
              items={monthlyItems}
              lists={monthlyLists}
              onAdd={onAddMonthlyItemsToWeek}
              onClose={() => setMonthlyPreviewOpen(false)}
            />

            {inListTotal > 0 && (
              <Text style={[styles.sectionTotal, { color: theme.textMuted }]}>
                {t.weekListTotal(formatKr(inListTotal, 0))}
              </Text>
            )}
          </View>
        )}

        {/* ── IN CART section ── */}
        {totalInCart > 0 && (
          <View style={styles.section}>
            <View
              ref={(node) => registerCartHeaderNode?.(node)}
              style={[styles.sectionHeaderRow, { backgroundColor: theme.surfaceMuted }]}
            >
              <Text style={[styles.sectionLabel, { color: theme.accent }]}>{t.inCartSection(totalInCart)}</Text>
              <View style={[styles.sectionRule, { backgroundColor: theme.accent }]} />
            </View>
            <View style={[styles.rowsCard, { backgroundColor: theme.surface, borderLeftColor: theme.accent }]}>
              {(filterActive ? filteredInCart : allChecked).map((item, idx, arr) => (
                <View key={item.id}>
                  <ShoppingRow
                    item={item}
                    variant="cart"
                    onToggle={() => onToggleItem(item)}
                    onRemove={() => onRemoveItem(item)}
                    onIncrement={() => onIncrementItem(item)}
                    onDecrement={() => onDecrementCartItem(item)}
                    locked={list.locked}
                  />
                  {idx < arr.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
            {inCartTotal > 0 && (
              <Text style={[styles.sectionTotal, { color: theme.textMuted }]}>
                {t.weekListTotal(formatKr(inCartTotal, 0))}
              </Text>
            )}
          </View>
        )}

        {/* ── PURCHASED section (collapsed) ── */}
        {purchased.length > 0 && (
          <View style={styles.section}>
            <ExpandableCard
              title={t.purchasedSection(purchased.length)}
              accentColor={theme.textMuted}
              defaultOpen={false}
            >
              {purchased.map((item, idx) => (
                <View key={item.id}>
                  <ShoppingRow
                    item={item}
                    variant="purchased"
                    onToggle={() => {}}
                    onRemove={() => onRemoveItem(item)}
                  />
                  {idx < purchased.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
              {purchasedTotal > 0 && (
                <Text style={[styles.sectionTotal, { color: theme.textMuted }]}>
                  {t.weekListTotal(formatKr(purchasedTotal, 0))}
                </Text>
              )}
            </ExpandableCard>
          </View>
        )}

        {/* ── Bottom slot: green "done" CTA while shopping; nothing while planning ──
            (the old "Plan mode active" status bar was removed 2026-07-22 — the
            Save/Discard buttons + lock icon already say everything it did). ── */}
        {list.locked && (
          <PressableScale
            style={[
              styles.doneShoppingBtn,
              { backgroundColor: theme.good, opacity: progress.inCart === 0 ? CHECKED_OPACITY : 1 },
            ]}
            onPress={onDoneShopping}
            disabled={progress.inCart === 0}
            pointerEvents={progress.inCart === 0 ? 'none' : 'auto'}
            scaleTo={0.95}
          >
            <Text style={[styles.doneShoppingText, { color: theme.textInverse }]}>{t.doneShoppingBtn}</Text>
          </PressableScale>
        )}
      </View>
      </Collapsible>
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  cardRow: { borderRadius: Radius.md },
  cardContent: { flex: 1, padding: Spacing.md, gap: Spacing.md },
  header: { gap: Spacing.xs },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  nameWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  repeatIcon: {},
  nameInput: {
    fontFamily: Type.heading.fontFamily,
    fontSize: Type.heading.size,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    flex: 1,
  },
  // Tap-to-edit preview (2026-07-22) — same padding footprint as nameInput but no
  // border/background, so swapping between preview Text and TextInput doesn't jump layout.
  namePreviewBtn: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  namePreviewText: {
    fontFamily: Type.heading.fontFamily,
    fontSize: Type.heading.size,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  compactProgressRow: { paddingVertical: Spacing.xs },
  compactProgressText: { fontSize: FontSize.sm },
  bodyGap: { gap: Spacing.md },
  emptyState: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  emptyTitle: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size, textAlign: 'center' },
  emptySubtitle: { fontSize: FontSize.sm, textAlign: 'center' },
  section: { gap: Spacing.xs },
  // Visual-audit 2026-07-11: a surfaceMuted card behind the label + rule so "sub-headers"
  // (In list / In cart / From monthly list) read with real weight instead of floating
  // bare text over the particle background — background colour applied inline (theme).
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  sectionRule: { flex: 1, height: 2, borderRadius: Radius.full, opacity: 0.4 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTotal: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, textAlign: 'right', paddingTop: Spacing.xs },
  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderLeftWidth: 3 },
  rowDivider: { height: 1 },
  // Two visible secondary add buttons ("From monthly" / "From a dish") — quiet bordered
  // pills that sit below InlineAddItem's primary "+" bar without competing with it.
  addOptionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  addOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  addOptionText: { fontFamily: Type.label.fontFamily, fontSize: FontSize.sm },
  doneShoppingBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  doneShoppingText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
