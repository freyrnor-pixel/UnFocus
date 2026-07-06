/**
 * WeekListCard.tsx — one per-list container per weekly ShoppingList row.
 *
 * Simplified layout (2026-07-06 redesign): three clean sections — In list
 * (all unchecked items, ungrouped and dish-grouped flattened together),
 * In cart (all checked items), Purchased (completed trip items for this list,
 * collapsed). An optional fourth section — From monthly list — appears when
 * the user opens the monthly add panel and closes when they tap ✓ (save) or
 * × (undo adds). Each section shows a price total footer. Dish groups are
 * no longer rendered as nested ExpandableCards; all items are flat rows.
 *
 * Connections:
 *   Imports → components/AddDivider, components/ExpandableCard, components/IconButton,
 *             components/Surface, components/ShoppingRow (CHECKED_OPACITY), constants/theme,
 *             lib/i18n, lib/money (formatKr), lib/shoppingGroups (listProgress, listTotal),
 *             lib/useAppTheme, lib/haptics,
 *             store/useShoppingListStore (ShoppingList type), store/useShoppingStore
 *             (ShoppingItem type)
 *   Used by → app/shopping.tsx
 *   Data    → none directly — every item/group/callback is owned by the parent
 *
 * Edit notes:
 *   - 2026-07-06 redesign: removed dish-group ExpandableCards, inline catalogue search,
 *     monthly-preview toggle button. Replaced with flat "In list" / "In cart" / "Purchased"
 *     sections and an ephemeral "From monthly list" panel section.
 *   - `dishGroups` prop is kept so this card can flatten dish items into the right section
 *     buckets without the parent having to recompute. The parent still calls
 *     computeListGroups() for drag-reorder state; this card just consumes the output.
 *   - `renderReorderableRow` is still used for ungroupedUnchecked items only (drag reorder).
 *     Dish-grouped unchecked items render as plain ShoppingRow (no drag wrapper).
 *   - Monthly session tracking: `monthlySessionAdds` records item names added while the
 *     monthly panel is open. ✓ clears the tracking and closes; × calls onRemoveItem for
 *     every fromCatalog weekly item whose name was tracked, then clears and closes.
 *   - listProgress() is still called here for the compact progress line on non-focused lists
 *     and the "Shopping done!" disabled state — same helper, same data.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ShoppingList } from '@/store/useShoppingListStore';
import { ShoppingItem } from '@/store/useShoppingStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { listProgress } from '@/lib/shoppingGroups';
import { formatKr } from '@/lib/money';
import Surface from '@/components/Surface';
import IconButton from '@/components/IconButton';
import ExpandableCard from '@/components/ExpandableCard';
import AddDivider from '@/components/AddDivider';
import PressableScale from '@/components/PressableScale';
import ShoppingRow, { CHECKED_OPACITY } from '@/components/ShoppingRow';
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
  onCollectItem: (item: ShoppingItem) => void;
  onRemoveItem: (item: ShoppingItem) => void;
  onIncrementItem: (item: ShoppingItem) => void;
  onDecrementItem: (item: ShoppingItem) => void;
  onAddPress: () => void;
  /** The curated monthly-list items (status 'catalog') shown in the "add from monthly" panel. */
  monthlyItems: ShoppingItem[];
  /** Move a monthly-list item into this week list (parent → addToWeeklyFromCatalog). */
  onAddMonthlyToWeek: (item: ShoppingItem) => void;
  onDoneShopping: () => void;
  /** Renders one reorderable "In list" ungrouped row — parent wraps it in DraggableTaskRow. */
  renderReorderableRow: (item: ShoppingItem, index: number, total: number) => React.ReactNode;
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
  onCollectItem,
  onRemoveItem,
  onIncrementItem,
  onDecrementItem,
  onAddPress,
  monthlyItems,
  onAddMonthlyToWeek,
  onDoneShopping,
  renderReorderableRow,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(list.name);
  const [monthlyPreviewOpen, setMonthlyPreviewOpen] = useState(false);
  const [monthlySearch, setMonthlySearch] = useState('');
  // Names (lowercased) of monthly items added during this panel session — used for undo.
  const [monthlySessionAdds, setMonthlySessionAdds] = useState<string[]>([]);

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

  // Flatten dish-grouped items into the appropriate section buckets.
  const dishUnchecked = useMemo(
    () => dishGroups.flatMap(([, items]) => items.filter((i) => !i.checked)),
    [dishGroups]
  );
  const dishChecked = useMemo(
    () => dishGroups.flatMap(([, items]) => items.filter((i) => i.checked)),
    [dishGroups]
  );

  // All unchecked = ungrouped (draggable, rendered via renderReorderableRow) + dish items (flat ShoppingRow).
  // All checked = ungrouped checked + dish checked.
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
    // Try to undo items that were added as fromCatalog flips this session.
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

  return (
    <Surface style={styles.card}>
      {/* ── Card header: title + lock/rename/settings/delete icons ── */}
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
            <Pressable onPress={() => setEditing(true)} style={styles.nameTapTarget}>
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
            </Pressable>
          )}

          <View style={styles.iconRow}>
            <IconButton
              icon={list.locked ? 'lock-closed' : 'lock-open-outline'}
              label={list.locked ? t.unlockListButtonLabel : t.lockListButtonLabel}
              onPress={onToggleLock}
              size={30}
              active={list.locked}
            />
            <IconButton icon="bookmark-outline" label={t.savedListsButtonLabel} onPress={onOpenSavedLists} size={30} />
            <IconButton icon="options-outline" label={t.listSettingsButtonLabel} onPress={onOpenListSettings} size={30} />
            <IconButton icon="trash-outline" label={t.deleteListButtonLabel} onPress={onDelete} size={30} color={theme.bad} />
          </View>
        </View>

        {!focused && progress.total > 0 && (
          <Pressable onPress={onFocus} style={styles.compactProgressRow}>
            <Text style={[styles.compactProgressText, { color: theme.textMuted }]}>
              {t.shoppingRemaining(progress.remaining, progress.inCart)}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.bodyGap}>
        {progress.total === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.weeklyEmptyTitle}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>{t.weeklyEmptySubtitle}</Text>
          </View>
        )}

        {/* ── FROM MONTHLY LIST section (ephemeral, appears while adding from monthly) ── */}
        {monthlyPreviewOpen && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.good }]}>{t.fromMonthlySection}</Text>
              <View style={styles.sectionRule} />
              <Pressable
                onPress={handleConfirmMonthly}
                hitSlop={8}
                accessibilityLabel={t.saveMonthlyAddsLabel}
                style={styles.monthlyActionBtn}
              >
                <Ionicons name="checkmark-circle" size={24} color={theme.good} />
              </Pressable>
              <Pressable
                onPress={handleCancelMonthly}
                hitSlop={8}
                accessibilityLabel={t.removeMonthlyAddsLabel}
                style={styles.monthlyActionBtn}
              >
                <Ionicons name="close-circle" size={24} color={theme.bad} />
              </Pressable>
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
                      <Pressable
                        style={styles.monthlyPanelRow}
                        onPress={() => handleAddMonthlyItem(item)}
                        disabled={isAdded}
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
                      </Pressable>
                      {idx < filteredMonthlyItems.length - 1 && (
                        <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── IN LIST section ── */}
        {totalInList > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.good }]}>{t.inListSection(totalInList)}</Text>
              <View style={[styles.sectionRule, { backgroundColor: theme.good }]} />
            </View>
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
                  />
                  {idx < dishUnchecked.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
            {inListTotal > 0 && (
              <Text style={[styles.sectionTotal, { color: theme.textMuted }]}>
                {t.weekListTotal(formatKr(inListTotal, 0))}
              </Text>
            )}
          </View>
        )}

        {/* Add item + Add from monthly list buttons */}
        <View style={styles.addRow}>
          <View style={styles.addDividerWrap}>
            <AddDivider onPress={onAddPress} disabled={list.locked} />
          </View>
          {!list.locked && monthlyItems.length > 0 && !monthlyPreviewOpen && (
            <Pressable
              style={[styles.monthlyTrigger, { borderColor: theme.good }]}
              onPress={() => setMonthlyPreviewOpen(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={theme.good} />
              <Text style={[styles.monthlyTriggerText, { color: theme.good }]}>{t.addFromMonthlyBtn}</Text>
            </Pressable>
          )}
        </View>

        {/* ── IN CART section ── */}
        {totalInCart > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
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
                    onCollect={() => onCollectItem(item)}
                    onRemove={() => onRemoveItem(item)}
                    onIncrement={() => onIncrementItem(item)}
                    onDecrement={() => onDecrementItem(item)}
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
        >
          <Text style={[styles.doneShoppingText, { color: theme.textInverse }]}>{t.doneShoppingBtn}</Text>
        </PressableScale>
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
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
  compactProgressRow: { paddingVertical: 2 },
  compactProgressText: { fontSize: FontSize.sm },
  bodyGap: { gap: Spacing.md },
  emptyState: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold, textAlign: 'center' },
  emptySubtitle: { fontSize: FontSize.sm, textAlign: 'center' },
  section: { gap: Spacing.xs },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionRule: { flex: 1, height: 2, borderRadius: Radius.full, opacity: 0.4 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTotal: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, textAlign: 'right', paddingTop: 2 },
  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderLeftWidth: 3 },
  rowDivider: { height: 1 },
  addRow: { gap: Spacing.xs },
  addDividerWrap: {},
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
  // Monthly panel section styles
  monthlyActionBtn: { padding: 2 },
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
    paddingVertical: Spacing.sm,
  },
  monthlyPanelName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  monthlyPanelPrice: { fontSize: FontSize.xs },
  monthlyAddBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneShoppingBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 44 },
  doneShoppingText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
