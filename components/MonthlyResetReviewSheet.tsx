/**
 * MonthlyResetReviewSheet.tsx — interactive pre-reset review for the payday-boundary reset.
 *
 * Shown BEFORE useShoppingStore.monthlyReset() commits (both the automatic payday-boundary
 * trigger and the manual "reset now" action in app/(tabs)/shopping.tsx). Lets the user, in
 * one scrollable sheet: (1) keep or discard each non-template shopping list, drag-reordered
 * via the same long-press primitives the rest of the app uses, and (2) adjust how much of
 * each Katalog item they currently have (writes the previously-unused `inventoryQty` column).
 * "Skip" and closing the sheet any other way both finalize with zero discards — i.e. exactly
 * today's pre-existing reset behavior — so there is no dead-end state.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/DraggableTaskRow,
 *             components/ExpandableCard, components/PressableScale, components/Surface,
 *             components/FormControls (Switch), constants/theme, lib/i18n, lib/reorder
 *             (reorderByDrag), lib/useAppTheme, store/useShoppingListStore (ShoppingList
 *             type), store/useShoppingStore (ShoppingItem type)
 *   Used by → app/(tabs)/shopping.tsx
 *   Data    → none directly — `lists`/`catalogItems` are owned by the parent; every mutation
 *             (reorder, inventory qty) is applied immediately via the callback props, except
 *             the keep/discard choice, which is buffered locally (a Set of discarded ids)
 *             until `onFinalize` fires, so it stays reversible while the sheet is open.
 *
 * Edit notes:
 *   - Reorder follows components/HomeCardManager.tsx's pattern (own drag/snapshot state,
 *     flat single list, no cross-section hit-testing) rather than app/(tabs)/shopping.tsx's
 *     own dish-merge version — this sheet has no dish groups to reconcile against.
 *     `onReorderLists` fires once per completed drag with the full new id order; the caller
 *     persists it via useShoppingListStore.update(id, { sortOrder }) per changed id.
 *   - Discarded lists are NOT removed on toggle — only tracked locally — because the toggle
 *     needs to stay undoable up until the user actually commits (Skip or Confirm). The
 *     parent's onFinalize receives the final discarded-id array and does the actual
 *     useShoppingListStore.remove() calls, immediately followed by the existing
 *     buildMonthlyResetSummary()/monthlyReset() pair.
 *   - Inventory qty edits apply immediately (onSetInventoryQty), matching every other
 *     stepper in this codebase (MonthlyTableRow's targetQuantity stepper, etc.) — no
 *     buffer/save step, since editing your current stock count isn't destructive the way
 *     discarding a list is.
 */
import React, { useRef, useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { reorderByDrag } from '@/lib/reorder';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import ExpandableCard from '@/components/ExpandableCard';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import { Switch } from '@/components/FormControls';
import { ShoppingList } from '@/store/useShoppingListStore';
import { ShoppingItem } from '@/store/useShoppingStore';

type Props = {
  visible: boolean;
  lists: ShoppingList[];
  itemCountByListId: Record<string, number>;
  catalogItems: ShoppingItem[];
  onReorderLists: (order: string[]) => void;
  onSetInventoryQty: (id: string, qty: number) => void;
  onFinalize: (discardedListIds: string[]) => void;
};

type DragState = { id: string; order: string[] };

export default function MonthlyResetReviewSheet({
  visible,
  lists,
  itemCountByListId,
  catalogItems,
  onReorderLists,
  onSetInventoryQty,
  onFinalize,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();

  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());
  const wasVisible = useRef(visible);
  if (visible && !wasVisible.current) setDiscardedIds(new Set());
  wasVisible.current = visible;

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const nodes = useRef<Map<string, any>>(new Map());
  const snapshot = useRef<Record<string, { y: number; height: number }>>({});

  const order = lists.map((l) => l.id);
  const liveOrder = drag?.order ?? order;

  function registerNode(id: string, node: any) {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }

  function handleDragStart(id: string) {
    snapshot.current = {};
    for (const rowId of order) {
      nodes.current.get(rowId)?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        snapshot.current[rowId] = { y, height: h };
      });
    }
    setDrag({ id, order });
  }

  function handleDragMove(id: string, centerY: number) {
    setDrag((prev) => {
      if (!prev || prev.id !== id) return prev;
      if (!Object.keys(snapshot.current).length) return prev;
      const next = reorderByDrag(centerY, prev.order, id, snapshot.current);
      if (!next.some((rowId, i) => rowId !== prev.order[i])) return prev;
      if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return { ...prev, order: next };
    });
  }

  function handleDragEnd(id: string) {
    const prev = dragRef.current;
    if (prev && prev.id === id) {
      const changed = prev.order.some((rowId, i) => rowId !== order[i]);
      if (changed) onReorderLists(prev.order);
    }
    setDrag(null);
  }

  function toggleKeep(id: string) {
    setDiscardedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSkip() {
    onFinalize([]);
  }

  function handleConfirm() {
    onFinalize([...discardedIds]);
  }

  const orderedLists = liveOrder.map((id) => lists.find((l) => l.id === id)).filter((l): l is ShoppingList => !!l);

  return (
    <AnimatedBottomSheet visible={visible} onClose={handleSkip}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.monthlyResetReviewTitle}</Text>
        <Text style={[styles.intro, { color: theme.textMuted }]}>{t.monthlyResetReviewIntro}</Text>

        <View style={styles.scroll}>
          <ExpandableCard title={t.monthlyResetReviewListsSection} badge={String(lists.length)} defaultOpen>
            {orderedLists.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.monthlyResetReviewEmptyLists}</Text>
            ) : (
              orderedLists.map((list) => (
                <DraggableTaskRow
                  key={list.id}
                  isOpen={false}
                  registerNode={(node) => registerNode(list.id, node)}
                  onDragStart={() => handleDragStart(list.id)}
                  onDragMove={(centerY) => handleDragMove(list.id, centerY)}
                  onDragEnd={() => handleDragEnd(list.id)}
                >
                  <View style={[styles.listRow, { borderTopColor: theme.border }]}>
                    <View style={styles.listRowText}>
                      <Text style={[styles.listName, { color: theme.text }]} numberOfLines={1}>{list.name}</Text>
                      <Text style={[styles.listMeta, { color: theme.textMuted }]}>
                        {t.monthlyResetReviewListItemCount(itemCountByListId[list.id] ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.keepBlock}>
                      <Text style={[styles.keepLabel, { color: theme.textMuted }]}>{t.monthlyResetReviewKeepListLabel}</Text>
                      <Switch checked={!discardedIds.has(list.id)} onChange={() => toggleKeep(list.id)} />
                    </View>
                  </View>
                </DraggableTaskRow>
              ))
            )}
          </ExpandableCard>

          <ExpandableCard title={t.monthlyResetReviewInventorySection} badge={String(catalogItems.length)} defaultOpen>
            <Text style={[styles.hintText, { color: theme.textMuted }]}>{t.monthlyResetReviewInventoryHint}</Text>
            {catalogItems.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.monthlyResetReviewEmptyInventory}</Text>
            ) : (
              catalogItems.map((item) => (
                <View key={item.id} style={[styles.invRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.invName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.stepperRow}>
                    <PressableScale
                      style={[styles.stepBtn, { backgroundColor: theme.surfaceMuted }]}
                      onPress={() => onSetInventoryQty(item.id, Math.max(0, item.inventoryQty - 1))}
                      hitSlop={6}
                      scaleTo={0.9}
                    >
                      <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
                    </PressableScale>
                    <Text style={[styles.qtyText, { color: theme.text }]}>{item.inventoryQty}</Text>
                    <PressableScale
                      style={[styles.stepBtn, { backgroundColor: theme.accent }]}
                      onPress={() => onSetInventoryQty(item.id, item.inventoryQty + 1)}
                      hitSlop={6}
                      scaleTo={0.9}
                    >
                      <Text style={[styles.stepText, { color: theme.accentInk }]}>+</Text>
                    </PressableScale>
                  </View>
                </View>
              ))
            )}
          </ExpandableCard>
        </View>

        <View style={styles.footer}>
          <PressableScale style={[styles.footerBtn, { backgroundColor: theme.surfaceMuted }]} onPress={handleSkip} scaleTo={0.97}>
            <Text style={[styles.footerBtnText, { color: theme.text }]}>{t.monthlyResetReviewSkipBtn}</Text>
          </PressableScale>
          <PressableScale style={[styles.footerBtn, { backgroundColor: theme.accent }]} onPress={handleConfirm} scaleTo={0.95}>
            <Text style={[styles.footerBtnText, { color: theme.accentInk }]}>{t.monthlyResetReviewConfirmBtn}</Text>
          </PressableScale>
        </View>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  intro: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  scroll: { marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.md },
  hintText: { fontSize: FontSize.xs, marginBottom: Spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  listRowText: { flex: 1, minWidth: 0 },
  listName: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  listMeta: { fontSize: FontSize.xs, marginTop: 2 },
  keepBlock: { alignItems: 'center', gap: 2 },
  keepLabel: { fontSize: 10 },
  invRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  invName: { flex: 1, fontSize: FontSize.sm, minWidth: 0 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  qtyText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, minWidth: 20, textAlign: 'center' },
  footer: { flexDirection: 'row', gap: Spacing.sm },
  footerBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  footerBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
