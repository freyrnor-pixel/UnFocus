/**
 * WeekListCard.tsx — one per-list container per weekly ShoppingList row.
 *
 * Every non-template shopping_lists row gets its own card in the weekly tab's
 * scrolling body. Owns this list's own chrome — inline rename, lock toggle,
 * saved-lists/list-settings/delete icons — and renders its three sections
 * ("From meals" dish groups / "Shopping list" ungrouped rows / collapsed
 * "Bought this week" history) plus its own "Shopping done!" button. Every
 * item/group/callback is pre-computed and scoped to this list's id by the
 * parent (app/shopping.tsx); this is a dumb presentational component, same
 * divide as ShoppingRow/MonthlyTableRow.
 *
 * Connections:
 *   Imports → components/AddDivider, components/ExpandableCard, components/IconButton,
 *             components/Surface, components/ShoppingRow (CHECKED_OPACITY), constants/theme,
 *             lib/i18n, lib/shoppingGroups (listProgress, dishGroupAllChecked), lib/useAppTheme,
 *             lib/haptics, store/useShoppingListStore (ShoppingList type), store/useShoppingStore
 *             (ShoppingItem type), store/useMealStore (Dish type)
 *   Used by → app/shopping.tsx
 *   Data    → none directly — every item/group/callback is owned by the parent
 *
 * Edit notes:
 *   - New file (2026-07-02, Session A2·2, expanded scope — see PROGRESS_LOG). Decision 011
 *     (A2-1/A2-4/R1/R3) targets a screen re-layout that composes this card, and Decision
 *     017 resolves its container role — but the card itself was never ported; it did not
 *     exist anywhere in this repo before this session. Built fresh against both decisions
 *     rather than a byte-for-byte port of the old repo's WeekListCard.tsx, which wrapped
 *     everything in the old padlock-gated `Container.tsx` component. `Container.tsx` is
 *     NOT ported here — ExpandableCard.tsx's own header already documents itself as this
 *     card's intended base (Decision 009), so Container is superseded, not skipped. This
 *     card wraps its content directly in `<Surface>` instead and hand-rolls the header
 *     row (title/lock/rightAction) that `Container` used to own.
 *   - Decision 017 Q1: keeps its own list-level chrome (title, lock, delete, bookmark) —
 *     NOT dissolved, screen doesn't render sections directly. Also wires the list-settings
 *     (recurring toggle) icon to `components/ListSettingsSheet.tsx`, which existed in this
 *     repo since Phase 3b but had no caller yet ("Phase 5 screen: app/shopping.tsx" per its
 *     own header) — this card is that caller.
 *   - Decision 017 Q3/Q4 + its "bounded amendment": the FULL summary/progress block was
 *     lifted OUT to the screen-level sticky header (A2-1), which only ever reflects the
 *     FOCUSED list. This card shows a COMPACT inline progress line instead, but only when
 *     `!focused` — the focused list's line is already promoted into the sticky bar, so
 *     showing it twice would duplicate the same number in two places on screen at once.
 *     Tapping that compact line calls `onFocus` — the documented focus-switch affordance.
 *     Both this line and the sticky header call the SAME `listProgress()` helper
 *     (lib/shoppingGroups.ts) on the same computeListGroups() output — "one progress
 *     calculation, two presentations; no fork" (Decision 017 note 3).
 *   - Decision 011 A2-4: the old repo's always-visible "In cart" Surface section is now a
 *     collapsed `t.boughtThisWeekSection(n)` ExpandableCard (uncontrolled, defaultOpen
 *     false) at the bottom of the body, expanding in place — same disclosure idiom the
 *     dish groups already use.
 *   - Decision 011 R1: the "Shopping list" (ungrouped-unchecked) section is the ONLY
 *     reorderable one (matches the old inline move-chevrons' scope — dish-group and
 *     checked rows never had move buttons either). This card does NOT wrap those rows in
 *     DraggableTaskRow itself — the parent screen owns drag/hit-testing/live-reflow
 *     (Decision 011 R1's explicit session split) and supplies `renderReorderableRow`,
 *     which this card calls once per ungroupedUnchecked item instead of rendering
 *     `<ShoppingRow>` directly for that section only. Dish-group and checked rows are
 *     still rendered directly — they're never reorderable, so there's nothing for the
 *     parent to wrap.
 *   - Decision 011 R3: "Shopping done!" reuses ShoppingRow's exported CHECKED_OPACITY for
 *     its disabled dim instead of a re-declared literal — this button lived inside
 *     WeekListCard in the old app too, so the constant belongs here, not in app/shopping.tsx.
 *   - `list.locked` only gates add/remove/edit: every ShoppingRow gets locked={list.locked}
 *     (dims remove/move/stepper; checkmark/collect/undo stay interactive regardless), and
 *     the AddDivider below "Shopping list" is disabled via its own `disabled` prop — but
 *     "Shopping done!" is NEVER lock-gated (finishing a trip isn't an edit).
 *   - Decision 011a/R4 wiring (2026-07-02, Phase 4): each dish-group ExpandableCard now
 *     renders a checkbox in `rightAction` reading `dishGroupAllChecked(groupItems)` (derived,
 *     never stored — 011a decision #2) and calling the new `onToggleDish` prop on tap. The
 *     parent (app/shopping.tsx) owns the actual bulk-toggle: check every unchecked ingredient
 *     if not all are checked, uncheck every ingredient if all are (011a decision #1/#3 — no
 *     separate "un-check" case, it's the same roll-down write). This was flagged as
 *     out-of-scope during Session A2·2 ("dish groups render read-only ingredient rows, no
 *     parent/child checkbox binding attempted") despite R4 naming this card's dish-group
 *     session as the intended owner — closed here since the wiring only needed this
 *     component + `lib/shoppingGroups.ts`, no new decision.
 *   - Decision 022 drag-to-merge (2026-07-03): each dish-group card is wrapped in a measurable
 *     `<View>` whose native node is handed up via `registerDishGroupNode` so the parent screen
 *     can measureInWindow() it as a drop target at drag-start. When the dragged standalone row
 *     is over a group, the parent passes its name as `mergeHighlightDish` and this card tints
 *     that wrapper (theme.goodSoft + good border) so the valid drop is visible before release.
 *     Both props are optional — the merge/join drop logic itself lives in app/shopping.tsx.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ShoppingList } from '@/store/useShoppingListStore';
import { ShoppingItem } from '@/store/useShoppingStore';
import { Dish } from '@/store/useMealStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { listProgress, dishGroupAllChecked } from '@/lib/shoppingGroups';
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
  dishes: Dish[];
  ungroupedUnchecked: ShoppingItem[];
  checked: ShoppingItem[];
  onToggleLock: () => void;
  onRename: (name: string) => void;
  onOpenSavedLists: () => void;
  onOpenListSettings: () => void;
  onDelete: () => void;
  onToggleItem: (item: ShoppingItem) => void;
  /** Decision 011a/R4 bulk toggle: check all if not all are checked, uncheck all if all are. */
  onToggleDish: (items: ShoppingItem[]) => void;
  onCollectItem: (item: ShoppingItem) => void;
  onRemoveItem: (item: ShoppingItem) => void;
  onIncrementItem: (item: ShoppingItem) => void;
  onDecrementItem: (item: ShoppingItem) => void;
  onAddPress: () => void;
  onDoneShopping: () => void;
  /** Renders one reorderable "Shopping list" row — parent wraps it in DraggableTaskRow. */
  renderReorderableRow: (item: ShoppingItem, index: number, total: number) => React.ReactNode;
  /** Decision 022 drag-to-merge: hand the parent each dish-group card's native node so it can
   *  measureInWindow() the group as a drop target at drag-start. Optional. */
  registerDishGroupNode?: (dishName: string, node: any) => void;
  /** Decision 022 drag-to-merge: name of the dish group currently under the dragged row (a valid
   *  merge/join target) — highlighted so the user sees the drop will land there. */
  mergeHighlightDish?: string | null;
};

export default function WeekListCard({
  list,
  focused,
  onFocus,
  dishGroups,
  dishes,
  ungroupedUnchecked,
  checked,
  onToggleLock,
  onRename,
  onOpenSavedLists,
  onOpenListSettings,
  onDelete,
  onToggleItem,
  onToggleDish,
  onCollectItem,
  onRemoveItem,
  onIncrementItem,
  onDecrementItem,
  onAddPress,
  onDoneShopping,
  renderReorderableRow,
  registerDishGroupNode,
  mergeHighlightDish,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(list.name);

  useEffect(() => {
    setEditing(false);
    setNameInput(list.name);
  }, [list.id, list.name]);

  function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== list.name) onRename(trimmed);
    setEditing(false);
  }

  const progress = listProgress({ dishGroups, ungroupedUnchecked, checked });

  return (
    <Surface style={styles.card}>
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
        {dishGroups.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.good }]}>{t.fromMealsSection}</Text>
              <View style={[styles.sectionRule, { backgroundColor: theme.good }]} />
            </View>
            {dishGroups.map(([dishName, groupItems]) => {
              const dish = dishes.find((d) => d.name === dishName);
              const subtitle = t.ingredientsCount(groupItems.length);
              const allChecked = dishGroupAllChecked(groupItems);
              const isMergeTarget = mergeHighlightDish === dishName;
              return (
                <View
                  key={dishName}
                  ref={(node) => registerDishGroupNode?.(dishName, node)}
                  style={[
                    styles.dishGroupWrap,
                    isMergeTarget && { borderColor: theme.good, backgroundColor: theme.goodSoft },
                  ]}
                >
                <ExpandableCard
                  title={dishName}
                  subtitle={subtitle}
                  accentColor={theme.good}
                  defaultOpen={false}
                  rightAction={
                    <Pressable
                      style={[
                        styles.dishCheck,
                        allChecked ? { backgroundColor: theme.good, borderColor: theme.good } : { borderColor: theme.good },
                      ]}
                      onPress={() => onToggleDish(groupItems)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t.dishCheckAllLabel}
                      accessibilityState={{ checked: allChecked }}
                      hitSlop={6}
                    >
                      {allChecked && <Ionicons name="checkmark" size={14} color={theme.textInverse} />}
                    </Pressable>
                  }
                >
                  {groupItems.map((item, idx) => (
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
                      {idx < groupItems.length - 1 && (
                        <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                      )}
                    </View>
                  ))}
                </ExpandableCard>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: theme.good }]}>{t.inWeeklyListSection}</Text>
            <View style={[styles.sectionRule, { backgroundColor: theme.good }]} />
          </View>
          {ungroupedUnchecked.length > 0 && (
            <View style={[styles.rowsCard, { backgroundColor: theme.surface, borderLeftColor: theme.good }]}>
              {ungroupedUnchecked.map((item, idx) => (
                <View key={item.id}>
                  {renderReorderableRow(item, idx, ungroupedUnchecked.length)}
                  {idx < ungroupedUnchecked.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
          )}
          <AddDivider onPress={onAddPress} disabled={list.locked} />
        </View>

        {checked.length > 0 && (
          <ExpandableCard title={t.boughtThisWeekSection(checked.length)} accentColor={theme.textMuted} defaultOpen={false}>
            {checked.map((item, idx) => (
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
                {idx < checked.length - 1 && (
                  <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
          </ExpandableCard>
        )}

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
  section: { gap: Spacing.xs },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  sectionRule: { flex: 1, height: 2, borderRadius: Radius.full, opacity: 0.4 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, borderLeftWidth: 3 },
  // Decision 022: dish-group wrapper is measured as a drop target and tints when a valid
  // merge target. Transparent border by default so the tinted highlight doesn't shift layout.
  dishGroupWrap: { borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent' },
  rowDivider: { height: 1 },
  dishCheck: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneShoppingBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 44 },
  doneShoppingText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
