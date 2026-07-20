/**
 * HomeCardManager.tsx — hold-to-manage wrapper for Home's reorderable preview cards.
 *
 * Wraps an ordered stack of "kind"-keyed cards (Notes/Plans/Shopping) so long-pressing
 * any card enters an edit mode where every card becomes draggable and gets a delete (×)
 * badge, plus an "Add a card" tile for re-adding a removed kind. Mirrors
 * DraggableTaskRow's "owns no data" contract — reorder/remove/add are bubbled to the
 * parent via callbacks; this component only owns edit-mode state and drives the shared
 * flat-list drag math (lib/reorder.reorderByDrag — the same stable, no-flicker insertion
 * used by app/(tabs)/shopping.tsx's in-section reorder).
 *
 * Connections:
 *   Imports → components/DraggableTaskRow, components/PressableScale, constants/theme,
 *             lib/haptics, lib/i18n, lib/reorder (reorderByDrag), lib/useAppTheme
 *   Used by → app/(tabs)/index.tsx (Home's Notes/Plans/Shopping preview stack)
 *   Data    → none — pure presentational, all mutations bubbled up via callbacks
 *
 * Edit notes:
 *   - Drag is always enabled per row (no `isOpen` lift from the wrapped cards' own
 *     internal expand/collapse state — HomeNotesCard/HomeShoppingCard manage that
 *     privately). Dragging a card while it happens to be expanded works but reflows a
 *     larger block; accepted trade-off vs. threading expand state through three
 *     separately-owned card components for this.
 *   - A long-press on ANY card both enters edit mode AND starts that card's drag in one
 *     motion (DraggableTaskRow's onDragStart fires ~400ms into the hold, even with zero
 *     movement) — there's no separate "tap Edit first" step, matching "holding a card makes
 *     them all reorderable."
 *   - Relies on the Android LayoutAnimation global enable that ExpandableCard.tsx sets at
 *     module scope (same assumption DraggableTaskRow.tsx documents) — HomeShoppingCard
 *     imports ExpandableCard, so it's already set by the time this mounts on Home.
 *   - Deletion floor: `order.length <= 1` disables the last remaining card's × rather
 *     than allowing an empty Home — no separate empty-state UI needed.
 */
import React, { useRef, useState } from 'react';
import { LayoutAnimation, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap, warning } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { reorderByDrag } from '@/lib/reorder';

type Props = {
  /** Ordered, currently-visible kind ids (e.g. ['notes', 'shopping']). */
  order: string[];
  /** Full known kind set → label, for the add-picker and remove a11y labels. */
  labels: Record<string, string>;
  onReorder: (order: string[]) => void;
  onRemove: (kind: string) => void;
  onAdd: (kind: string) => void;
  renderCard: (kind: string) => React.ReactNode;
};

type DragState = { kind: string; order: string[] };

export default function HomeCardManager({ order, labels, onReorder, onRemove, onAdd, renderCard }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();

  const [editMode, setEditMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const nodes = useRef<Map<string, any>>(new Map());
  const snapshot = useRef<Record<string, { y: number; height: number }>>({});

  const missingKinds = Object.keys(labels).filter((k) => !order.includes(k));

  function registerNode(kind: string, node: any) {
    if (node) nodes.current.set(kind, node);
    else nodes.current.delete(kind);
  }

  function handleDragStart(kind: string) {
    setEditMode(true);
    snapshot.current = {};
    for (const k of order) {
      nodes.current.get(k)?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        snapshot.current[k] = { y, height: h };
      });
    }
    setDrag({ kind, order });
  }

  function handleDragMove(kind: string, centerY: number) {
    setDrag((prev) => {
      if (!prev || prev.kind !== kind) return prev;
      if (!Object.keys(snapshot.current).length) return prev;
      // Stable, no-flicker insertion (lib/reorder): re-inserts the dragged card at the finger's
      // position among the OTHERS, so a completed swap can't bounce back under the finger.
      const next = reorderByDrag(centerY, prev.order, kind, snapshot.current);
      if (!next.some((k, i) => k !== prev.order[i])) return prev;
      if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return { ...prev, order: next };
    });
  }

  function handleDragEnd(kind: string) {
    const prev = dragRef.current;
    if (prev && prev.kind === kind) {
      const changed = prev.order.some((k, i) => k !== order[i]);
      if (changed) onReorder(prev.order);
    }
    setDrag(null);
  }

  function handleRemove(kind: string) {
    if (order.length <= 1) return;
    warning();
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onRemove(kind);
  }

  function handleAdd(kind: string) {
    tap();
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onAdd(kind);
    setPickerOpen(false);
  }

  const liveOrder = drag?.order ?? order;

  return (
    <View>
      {editMode && (
        <View style={styles.editBar}>
          <PressableScale
            style={[styles.doneBtn, { backgroundColor: theme.accent }]}
            onPress={() => {
              tap();
              setEditMode(false);
            }}
          >
            <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.home.manageCards.done}</Text>
          </PressableScale>
        </View>
      )}

      {liveOrder.map((kind) => (
        <DraggableTaskRow
          key={kind}
          isOpen={false}
          registerNode={(node) => registerNode(kind, node)}
          onDragStart={() => handleDragStart(kind)}
          onDragMove={(centerY) => handleDragMove(kind, centerY)}
          onDragEnd={() => handleDragEnd(kind)}
        >
          <View>
            {renderCard(kind)}
            {editMode && (
              <Pressable
                style={[
                  styles.removeBadge,
                  { backgroundColor: theme.bad, borderColor: theme.surface },
                  order.length <= 1 && styles.removeBadgeDisabled,
                ]}
                onPress={() => handleRemove(kind)}
                hitSlop={8}
                disabled={order.length <= 1}
                accessibilityRole="button"
                accessibilityLabel={t.home.manageCards.remove(labels[kind] ?? kind)}
              >
                <Ionicons name="close" size={12} color={theme.accentInk} />
              </Pressable>
            )}
          </View>
        </DraggableTaskRow>
      ))}

      {editMode && missingKinds.length > 0 && (
        <PressableScale
          style={[styles.addTile, { borderColor: theme.border }]}
          onPress={() => {
            tap();
            setPickerOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t.home.manageCards.add}
        >
          <Ionicons name="add" size={18} color={theme.accent} />
          <Text style={[styles.addTileText, { color: theme.accent }]}>{t.home.manageCards.add}</Text>
        </PressableScale>
      )}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.pickerWrap}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>{t.home.manageCards.add}</Text>
            {missingKinds.map((kind) => (
              <PressableScale key={kind} style={styles.pickerRow} onPress={() => handleAdd(kind)}>
                <Text style={[styles.pickerRowText, { color: theme.text }]}>{labels[kind] ?? kind}</Text>
              </PressableScale>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  editBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: Spacing.sm },
  doneBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.sm },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Shadow.button,
  },
  removeBadgeDisabled: { opacity: 0.4 },
  addTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  addTileText: { fontFamily: Fonts.bold, fontSize: FontSize.sm },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerWrap: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  pickerSheet: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.fab },
  pickerTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, marginBottom: Spacing.xs },
  pickerRow: { paddingVertical: Spacing.sm },
  pickerRowText: { fontSize: FontSize.md, fontFamily: Fonts.medium },
});
