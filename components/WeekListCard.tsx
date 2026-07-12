/**
 * WeekListCard.tsx — one per-list container per weekly ShoppingList row.
 *
 * Simplified layout (2026-07-06 redesign): three clean sections — In list
 * (all unchecked items, ungrouped and dish-grouped flattened together, plus an
 * always-visible inline add row when unlocked), In cart (all checked items),
 * Purchased (completed trip items for this list, collapsed). An optional
 * From-monthly-list panel appears inline inside the In list section, in place
 * of the "Legg til fra månedsliste" trigger button, when the user opens the
 * monthly add panel — it closes back to the trigger when they tap the Save
 * additions / Undo additions footer buttons. Each section shows a price total
 * footer. Dish groups are no longer rendered as nested ExpandableCards; all
 * items are flat rows.
 *
 * Connections:
 *   Imports → components/ExpandableCard, components/FlightOverlay (FlightRect type only), components/IconButton,
 *             components/Surface, components/ShoppingRow (CHECKED_OPACITY), constants/theme,
 *             lib/i18n, lib/money (formatKr), lib/shoppingGroups (listProgress, listTotal),
 *             lib/useAppTheme, lib/haptics,
 *             store/useCatalogStore (StoreItem, suggest),
 *             store/useShoppingListStore (ShoppingList type), store/useShoppingStore
 *             (ShoppingItem type)
 *   Used by → app/shopping.tsx
 *   Data    → none directly — every item/group/callback is owned by the parent
 *
 * Edit notes:
 *   - 2026-07-06 redesign: removed AddDivider + lock icon. Replaced with inline add row
 *     (TextInput + catalog search dropdown + qty controls + price total, visible only
 *     when unlocked) and a mode-toggle pill button ("Shopping" locked / "Planning" unlocked).
 *   - `dishGroups` prop is kept so this card can flatten dish items into the right section
 *     buckets without the parent having to recompute.
 *   - `renderReorderableRow` is still used for ungroupedUnchecked items only (drag reorder).
 *     Dish-grouped unchecked items render as plain ShoppingRow (no drag wrapper).
 *   - **2026-07-12 UX fix**: the monthly panel used to render as its own section ahead of
 *     "In list", so opening it (via a trigger button living at the bottom of "In list")
 *     made the card reorder above where the user had just tapped. It now renders inline,
 *     swapped in for the trigger button's own slot, and its confirm/cancel controls moved
 *     from a cramped icon-only row (squeezed next to the section label) to a labeled
 *     two-button footer below the item rows.
 *   - Monthly session tracking: `monthlySessionAdds` records item names added while the
 *     monthly panel is open. ✓ clears the tracking and closes; × calls onRemoveItem for
 *     every fromCatalog weekly item whose name was tracked, then clears and closes.
 *   - listProgress() is still called here for the compact progress line on non-focused lists
 *     and the "Shopping done!" disabled state — same helper, same data.
 *   - Outer card has a 4px `theme.featShop` left accent stripe (Surface split into
 *     `cardRow`/`accent`/`cardContent`), matching Home's preview-card treatment so the
 *     card reads as the same object when tapping through from Home into full Shopping.
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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ShoppingList } from '@/store/useShoppingListStore';
import { ShoppingItem } from '@/store/useShoppingStore';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { listProgress } from '@/lib/shoppingGroups';
import { formatKr } from '@/lib/money';
import Surface from '@/components/Surface';
import IconButton from '@/components/IconButton';
import ExpandableCard from '@/components/ExpandableCard';
import PressableScale from '@/components/PressableScale';
import ShoppingRow, { CHECKED_OPACITY } from '@/components/ShoppingRow';
import type { FlightRect } from '@/components/FlightOverlay';
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
  onToggleLock: () => void;
  onRename: (name: string) => void;
  onOpenSavedLists: () => void;
  onOpenListSettings: () => void;
  onDelete: () => void;
  onToggleItem: (item: ShoppingItem) => void;
  onRemoveItem: (item: ShoppingItem) => void;
  onIncrementItem: (item: ShoppingItem) => void;
  onDecrementItem: (item: ShoppingItem) => void;
  /** Inline add row submission — called when the user confirms adding a new item. */
  onAddInlineItem: (input: { name: string; price: number; qty: number }) => void;
  /** Decrement a cart item — at qty=1 moves it back to "In list"; at qty>1 splits one unit back. */
  onDecrementCartItem: (item: ShoppingItem) => void;
  /** The curated monthly-list items (status 'catalog') shown in the "add from monthly" panel. */
  monthlyItems: ShoppingItem[];
  /** Move a monthly-list item into this week list (parent → addToWeeklyFromCatalog). */
  onAddMonthlyToWeek: (item: ShoppingItem) => void;
  onDoneShopping: () => void;
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
  onToggleLock,
  onRename,
  onOpenSavedLists,
  onOpenListSettings,
  onDelete,
  onToggleItem,
  onRemoveItem,
  onIncrementItem,
  onDecrementItem,
  onAddInlineItem,
  onDecrementCartItem,
  monthlyItems,
  onAddMonthlyToWeek,
  onDoneShopping,
  renderReorderableRow,
  registerCartHeaderNode,
  onFlightStart,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(list.name);
  const [monthlyPreviewOpen, setMonthlyPreviewOpen] = useState(false);
  const [monthlySearch, setMonthlySearch] = useState('');
  const [monthlySessionAdds, setMonthlySessionAdds] = useState<string[]>([]);

  // Inline add row state
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState(0);
  const addInputRef = useRef<TextInput>(null);

  const suggest = useCatalogStore((s) => s.suggest);
  const addSearchResults = useMemo(
    () => (addName.trim().length >= 1 ? suggest(addName.trim(), 5) : []),
    [addName, suggest]
  );

  useEffect(() => {
    setEditing(false);
    setNameInput(list.name);
  }, [list.id, list.name]);

  useEffect(() => {
    if (list.locked) {
      setMonthlyPreviewOpen(false);
      setMonthlySessionAdds([]);
      setMonthlySearch('');
    }
  }, [list.locked]);

  function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== list.name) onRename(trimmed);
    setEditing(false);
  }

  function handleSelectSuggestion(result: StoreItem) {
    setAddName(result.name);
    setAddPrice(result.price);
  }

  function handleSubmitAddRow() {
    const name = addName.trim();
    if (!name) return;
    onAddInlineItem({ name, price: addPrice, qty: addQty });
    setAddName('');
    setAddQty(1);
    setAddPrice(0);
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

  const filteredMonthlyItems = useMemo(() => {
    const q = monthlySearch.trim().toLowerCase();
    if (!q) return monthlyItems;
    return monthlyItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [monthlyItems, monthlySearch]);

  function handleAddMonthlyItem(item: ShoppingItem) {
    const name = item.name.trim().toLowerCase();
    setMonthlySessionAdds((prev) => (prev.includes(name) ? prev : [...prev, name]));
    onAddMonthlyToWeek(item);
  }

  function handleConfirmMonthly() {
    setMonthlyPreviewOpen(false);
    setMonthlySessionAdds([]);
    setMonthlySearch('');
  }

  function handleCancelMonthly() {
    const allWeeklyItems = [...ungroupedUnchecked, ...checked, ...dishUnchecked, ...dishChecked];
    for (const name of monthlySessionAdds) {
      const weeklyItem = allWeeklyItems.find(
        (i) => i.name.trim().toLowerCase() === name && i.fromCatalog
      );
      if (weeklyItem) onRemoveItem(weeklyItem);
    }
    setMonthlyPreviewOpen(false);
    setMonthlySessionAdds([]);
    setMonthlySearch('');
  }

  const totalInList = ungroupedUnchecked.length + dishUnchecked.length;
  const totalInCart = allChecked.length;
  const showInListSection = totalInList > 0 || !list.locked;

  return (
    <Surface style={styles.cardRow}>
      <View style={[styles.accent, { backgroundColor: theme.featShop }]} />
      <View style={styles.cardContent}>
      {/* ── Card header: title + mode toggle + rename/settings/delete icons ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {editing ? (
            <TextInput
              style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t.listRenamePlaceholder}
              placeholderTextColor={theme.textMuted}
              autoFocus
              onSubmitEditing={commitRename}
              onBlur={commitRename}
              returnKeyType="done"
            />
          ) : (
            <PressableScale onPress={() => setEditing(true)} style={styles.nameTapTarget} scaleTo={0.97}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{list.name}</Text>
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
            </PressableScale>
          )}

          <View style={styles.iconRow}>
            {/* Mode toggle pill — "Shopping" (locked) / "Planning" (unlocked) */}
            <PressableScale
              style={[styles.modeToggle, { backgroundColor: list.locked ? theme.surfaceMuted : theme.good }]}
              onPress={onToggleLock}
              accessibilityRole="button"
              accessibilityLabel={list.locked ? t.unlockListButtonLabel : t.lockListButtonLabel}
              scaleTo={0.97}
            >
              <Text style={[styles.modeToggleText, { color: list.locked ? theme.textMuted : theme.textInverse }]}>
                {list.locked ? t.shoppingModeBtn : t.planningModeBtn}
              </Text>
            </PressableScale>
            <IconButton icon="bookmark-outline" label={t.savedListsButtonLabel} onPress={onOpenSavedLists} size={30} />
            <IconButton icon="options-outline" label={t.listSettingsButtonLabel} onPress={onOpenListSettings} size={30} />
            <IconButton icon="trash-outline" label={t.deleteListButtonLabel} onPress={onDelete} size={30} color={theme.bad} />
          </View>
        </View>

        {!focused && progress.total > 0 && (
          <PressableScale onPress={onFocus} style={styles.compactProgressRow} scaleTo={0.97}>
            <Text style={[styles.compactProgressText, { color: theme.textMuted }]}>
              {t.shoppingRemaining(progress.remaining, progress.inCart)}
            </Text>
          </PressableScale>
        )}
      </View>

      <View style={styles.bodyGap}>
        {progress.total === 0 && list.locked && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.weeklyEmptyTitle}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>{t.weeklyEmptySubtitle}</Text>
          </View>
        )}

        {/* ── IN LIST section ── */}
        {showInListSection && (
          <View style={styles.section}>
            <View style={[styles.sectionHeaderRow, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.sectionLabel, { color: theme.good }]}>{t.inListSection(totalInList)}</Text>
              <View style={[styles.sectionRule, { backgroundColor: theme.good }]} />
            </View>

            <View style={[styles.rowsCard, { backgroundColor: theme.surface, borderLeftColor: theme.good }]}>
              {ungroupedUnchecked.map((item, idx) => (
                <View key={item.id}>
                  {renderReorderableRow(item, idx, ungroupedUnchecked.length)}
                  {(idx < ungroupedUnchecked.length - 1 || dishUnchecked.length > 0 || !list.locked) && (
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
                  {(idx < dishUnchecked.length - 1 || !list.locked) && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}

              {/* Inline add row — only shown when unlocked (planning mode) */}
              {!list.locked && (
                <View>
                  <View style={styles.inlineAddRow}>
                    <TextInput
                      ref={addInputRef}
                      style={[styles.inlineAddInput, { color: theme.text }]}
                      value={addName}
                      onChangeText={(v) => {
                        setAddName(v);
                        if (!v.trim()) setAddPrice(0);
                      }}
                      placeholder={t.addItemInputPlaceholder}
                      placeholderTextColor={theme.textMuted}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmitAddRow}
                    />
                    <View style={styles.inlineQtyGroup}>
                      <PressableScale
                        style={[styles.inlineQtyBtn, { backgroundColor: theme.surfaceMuted }]}
                        onPress={() => setAddQty((q) => Math.max(1, q - 1))}
                        hitSlop={6}
                        scaleTo={0.9}
                      >
                        <Text style={[styles.inlineQtyBtnText, { color: theme.text }]}>−</Text>
                      </PressableScale>
                      <Text style={[styles.inlineQtyVal, { color: theme.text }]}>{addQty}</Text>
                      <PressableScale
                        style={[styles.inlineQtyBtn, { backgroundColor: theme.surfaceMuted }]}
                        onPress={() => setAddQty((q) => q + 1)}
                        hitSlop={6}
                        scaleTo={0.9}
                      >
                        <Text style={[styles.inlineQtyBtnText, { color: theme.text }]}>+</Text>
                      </PressableScale>
                    </View>
                    {addPrice > 0 && (
                      <Text style={[styles.inlineLineTotal, { color: theme.textMuted }]}>
                        {formatKr(addPrice * addQty, 0)}
                      </Text>
                    )}
                    <PressableScale
                      style={[
                        styles.inlineAddConfirmBtn,
                        { backgroundColor: addName.trim() ? theme.good : theme.surfaceMuted },
                      ]}
                      onPress={handleSubmitAddRow}
                      disabled={!addName.trim()}
                      hitSlop={4}
                      scaleTo={0.95}
                    >
                      <Text
                        style={[
                          styles.inlineAddConfirmText,
                          { color: addName.trim() ? theme.textInverse : theme.textMuted },
                        ]}
                      >
                        {t.a11yAdd}
                      </Text>
                    </PressableScale>
                  </View>

                  {/* Catalog search results */}
                  {addSearchResults.length > 0 && (
                    <View style={[styles.addSearchDropdown, { backgroundColor: theme.surfaceMuted }]}>
                      {addSearchResults.map((result, idx) => (
                        <View key={result.id}>
                          <PressableScale
                            style={styles.addSearchRow}
                            onPress={() => handleSelectSuggestion(result)}
                            scaleTo={0.97}
                          >
                            <Text style={[styles.addSearchName, { color: theme.text }]} numberOfLines={1}>
                              {result.name}
                            </Text>
                            {result.price > 0 && (
                              <Text style={[styles.addSearchPrice, { color: theme.textMuted }]}>
                                {formatKr(result.price, 0)}
                              </Text>
                            )}
                          </PressableScale>
                          {idx < addSearchResults.length - 1 && (
                            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Add from monthly list trigger — always visible in planning mode */}
            {!list.locked && !monthlyPreviewOpen && (
              <PressableScale
                style={[styles.monthlyTrigger, { borderColor: theme.good }]}
                onPress={() => setMonthlyPreviewOpen(true)}
                scaleTo={0.97}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.good} />
                <Text style={[styles.monthlyTriggerText, { color: theme.good }]}>{t.addFromMonthlyBtn}</Text>
              </PressableScale>
            )}

            {/* ── FROM MONTHLY LIST panel (ephemeral) — opens in place of the trigger
                above, right where the user tapped, instead of jumping to a separate
                section ahead of "In list". ── */}
            {!list.locked && monthlyPreviewOpen && (
              <View style={styles.monthlyPanel}>
                <View style={[styles.sectionHeaderRow, { backgroundColor: theme.surfaceMuted }]}>
                  <Text style={[styles.sectionLabel, { color: theme.good }]}>{t.fromMonthlySection}</Text>
                  <View style={[styles.sectionRule, { backgroundColor: theme.good }]} />
                </View>

                <TextInput
                  style={[styles.monthlySearch, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                  value={monthlySearch}
                  onChangeText={setMonthlySearch}
                  placeholder={t.monthlyPreviewSearchPlaceholder}
                  placeholderTextColor={theme.textMuted}
                />

                {filteredMonthlyItems.length === 0 ? (
                  <Text style={[styles.monthlyEmpty, { color: theme.textMuted }]}>{t.monthlyPreviewEmpty}</Text>
                ) : (
                  <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                    {filteredMonthlyItems.map((item, idx) => {
                      const isAdded = monthlySessionAdds.includes(item.name.trim().toLowerCase());
                      const lineTotal = item.price > 0 ? item.price * (parseInt(item.amount, 10) || 1) : null;
                      return (
                        <View key={item.id}>
                          <PressableScale
                            style={styles.monthlyPanelRow}
                            onPress={() => handleAddMonthlyItem(item)}
                            disabled={isAdded}
                            scaleTo={0.97}
                          >
                            <Text style={[styles.monthlyPanelName, { color: theme.text }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {lineTotal !== null && (
                              <Text style={[styles.monthlyPanelPrice, { color: theme.textMuted }]}>
                                {formatKr(lineTotal, 0)}
                              </Text>
                            )}
                            {isAdded ? (
                              <Ionicons name="checkmark-circle" size={22} color={theme.good} />
                            ) : (
                              <View style={[styles.monthlyAddBtn, { backgroundColor: theme.good }]}>
                                <Ionicons name="add" size={16} color={theme.textInverse} />
                              </View>
                            )}
                          </PressableScale>
                          {idx < filteredMonthlyItems.length - 1 && (
                            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.monthlyFooter}>
                  <PressableScale
                    style={[styles.monthlyFooterBtn, { backgroundColor: theme.good }]}
                    onPress={handleConfirmMonthly}
                    accessibilityLabel={t.saveMonthlyAddsLabel}
                    scaleTo={0.95}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={theme.textInverse} />
                    <Text style={[styles.monthlyFooterBtnText, { color: theme.textInverse }]}>
                      {t.saveMonthlyAddsLabel}
                    </Text>
                  </PressableScale>
                  <PressableScale
                    style={[styles.monthlyFooterBtn, { backgroundColor: theme.surfaceMuted }]}
                    onPress={handleCancelMonthly}
                    accessibilityLabel={t.removeMonthlyAddsLabel}
                    scaleTo={0.97}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.bad} />
                    <Text style={[styles.monthlyFooterBtnText, { color: theme.bad }]}>
                      {t.removeMonthlyAddsLabel}
                    </Text>
                  </PressableScale>
                </View>
              </View>
            )}

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
              {allChecked.map((item, idx) => (
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
                  {idx < allChecked.length - 1 && (
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

        {/* ── Shopping done button ── */}
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
      </View>
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  cardRow: { borderRadius: Radius.lg, flexDirection: 'row' },
  accent: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.lg, borderBottomLeftRadius: Radius.lg },
  cardContent: { flex: 1, padding: Spacing.md, gap: Spacing.md },
  header: { gap: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  nameTapTarget: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  name: { fontSize: FontSize.lg, fontFamily: Fonts.bold, flexShrink: 1 },
  repeatIcon: {},
  nameInput: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    flex: 1,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  modeToggle: {
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm,
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeToggleText: { fontSize: FontSize.xs, fontFamily: Fonts.bold, letterSpacing: 0.3 },
  compactProgressRow: { paddingVertical: 2 },
  compactProgressText: { fontSize: FontSize.sm },
  bodyGap: { gap: Spacing.md },
  emptyState: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold, textAlign: 'center' },
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
  sectionTotal: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, textAlign: 'right', paddingTop: 2 },
  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderLeftWidth: 3 },
  rowDivider: { height: 1 },
  // Inline add row
  inlineAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  inlineAddInput: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: 2,
  },
  inlineQtyGroup: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  inlineQtyBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineQtyBtnText: { fontSize: FontSize.md, fontFamily: Fonts.bold, lineHeight: 20 },
  inlineQtyVal: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, minWidth: 20, textAlign: 'center' },
  inlineLineTotal: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, minWidth: 40, textAlign: 'right' },
  // Visual-audit 2026-07-11: was an icon-only "+" circle — a plain-text "Add" pill
  // reads less ambiguously (the "+" alone was easy to mistake for something else,
  // since the row already has its own qty-stepper "+"/"−" buttons right next to it).
  inlineAddConfirmBtn: {
    minHeight: 30,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAddConfirmText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  addSearchDropdown: {
    borderRadius: Radius.sm,
    marginTop: 2,
    overflow: 'hidden',
  },
  addSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  addSearchName: { flex: 1, fontSize: FontSize.sm },
  addSearchPrice: { fontSize: FontSize.xs },
  // Monthly panel section styles
  monthlyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },
  monthlyTriggerText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  monthlyPanel: { gap: Spacing.xs },
  monthlySearch: {
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
  },
  monthlyEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.sm, textAlign: 'center' },
  monthlyPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  monthlyPanelName: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  monthlyPanelPrice: { fontSize: FontSize.xs },
  monthlyAddBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyFooter: { flexDirection: 'row', gap: Spacing.sm },
  monthlyFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minHeight: 44,
  },
  monthlyFooterBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  doneShoppingBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 44 },
  doneShoppingText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
