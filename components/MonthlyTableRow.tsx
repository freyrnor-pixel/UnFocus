/**
 * MonthlyTableRow.tsx — Katalog row (permanent inventory item).
 *
 * Renders one Katalog item in the consolidated "Item | Price per unit | x Amount |
 * Total cost" format: a leading checkbox (`onCheckboxPress`), the name (with a
 * "Midlertidig" pill badge when isTemporary), the target quantity, the per-unit
 * price, and the computed total (price × quantity). Tapping the row body opens the
 * Update Sheet when `onPress` is given — `onPress` is undefined while the Monthly
 * Container (app/(tabs)/shopping.tsx) is locked, so rows are inert in that state;
 * unlocking it (or the standalone inventory-edit screen) wires `onPress` and rows
 * become tappable.
 *
 * Connections:
 *   Imports → constants/theme, lib/date, lib/useAppTheme, store/useShoppingStore,
 *             components/PressableScale
 *   Used by → app/(tabs)/shopping.tsx (Monthly catalog tab), app/inventory-edit.tsx
 *   Data    → consumes the ShoppingItem type from useShoppingStore; mutations happen in the parent via onCheckboxPress/onPress; scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - **Decision 044a (2026-07-09):** renamed `onTogglePending` → `onCheckboxPress`.
 *     app/(tabs)/shopping.tsx's Monthly tab now wires it to move the item straight to
 *     the focused weekly list (addToWeeklyFromCatalog), replacing the old
 *     stage-then-confirm tray flow — the checkbox no longer reflects a lingering
 *     pendingRestock state since the row leaves the Monthly list on tap.
 *     app/inventory-edit.tsx (an orphaned standalone screen, out of 044a's scope)
 *     still wires it to the old setPendingRestock toggle — harmless, since that
 *     screen never rendered a tray to react to the flag.
 *   - targetQuantity is edited via the Update Sheet (components/UpdateSheet.tsx), OR — in
 *     the redesigned Monthly-list section (2026-07-06) — via the optional inline stepper
 *     (onIncrement/onDecrement drive targetQuantity in the parent) and the optional trailing
 *     × (onRemove). Both are opt-in props; when absent the row stays the plain read-mostly
 *     ×N display used elsewhere.
 *   - Swipe-to-delete was removed (it offered no other way to delete, and conflicted
 *     with the read-mostly main Katalog view). Deletion now only happens via the
 *     Update Sheet's existing inline 2-step confirm, reached by tapping a row where
 *     `onPress` is wired (Monthly Container unlocked, or app/inventory-edit.tsx).
 *   - Row background is a plain themed View, not a <Surface> — this row is a sub-row
 *     inside a parent-owned card (app/shopping.tsx wraps the whole ungrouped list in
 *     one Surface/card; rows just flow inside it separated by a divider), so wrapping
 *     each row in its own Surface would double up the material treatment.
 *   - Checkmark circle is a hand-rolled circular Pressable (not FormControls' square
 *     Checkbox) to match NoteRow's and TaskItem's shared circular "done" affordance.
 *   - Theming reads useAppTheme() internally.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingItem } from '@/store/useShoppingStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { formatKr } from '@/lib/money';
import PressableScale from '@/components/PressableScale';

type Props = {
  item: ShoppingItem;
  onCheckboxPress: () => void;
  onPress?: () => void;
  temporaryLabel?: string;
  /** When provided, an inline qty stepper (drives targetQuantity) replaces the static ×N meta. */
  onIncrement?: () => void;
  onDecrement?: () => void;
  /** When provided, a trailing × removes the item from the monthly list. */
  onRemove?: () => void;
};

function MonthlyTableRow({ item, onCheckboxPress, onPress, temporaryLabel, onIncrement, onDecrement, onRemove }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const total = item.price > 0 ? item.price * item.targetQuantity : null;
  const hasStepper = !!onIncrement && !!onDecrement;

  const Body = (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <PressableScale
        style={[styles.check, { borderColor: theme.accent }, item.pendingRestock && { backgroundColor: theme.accent, borderColor: theme.accent }]}
        onPress={onCheckboxPress}
        hitSlop={6}
        scaleTo={0.97}
      >
        {item.pendingRestock && <Ionicons name="checkmark" size={14} color={theme.accentInk} />}
      </PressableScale>

      <View style={styles.itemCol}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          {item.isTemporary && temporaryLabel && (
            <View style={[styles.tempPill, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.tempPillText, { color: theme.accent }]}>{temporaryLabel}</Text>
            </View>
          )}
          {hasStepper ? (
            <View style={styles.stepperRow}>
              <PressableScale style={[styles.stepBtn, { backgroundColor: theme.surfaceMuted }]} onPress={onDecrement} hitSlop={6} scaleTo={0.9}>
                <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
              </PressableScale>
              <Text style={[styles.qtyMeta, { color: theme.text }]}>×{item.targetQuantity}</Text>
              <PressableScale style={[styles.stepBtn, { backgroundColor: theme.accent }]} onPress={onIncrement} hitSlop={6} scaleTo={0.9}>
                <Text style={[styles.stepText, { color: theme.accentInk }]}>+</Text>
              </PressableScale>
            </View>
          ) : (
            <Text style={[styles.qtyMeta, { color: theme.textMuted }]}>×{item.targetQuantity}</Text>
          )}
        </View>
      </View>

      <View style={styles.priceCol}>
        <Text style={[styles.priceText, { color: theme.textMuted }]}>
          {item.price > 0 ? formatKr(item.price, 0) : '—'}
        </Text>
        {total !== null && (
          <Text style={[styles.totalText, { color: theme.text }]}>{`= ${formatKr(total, 0)}`}</Text>
        )}
      </View>

      {onRemove && (
        <PressableScale onPress={onRemove} hitSlop={6} style={styles.removeBtn} scaleTo={0.93}>
          <Ionicons name="close" size={18} color={theme.textMuted} />
        </PressableScale>
      )}
    </View>
  );

  if (!onPress) return Body;
  return <PressableScale onPress={onPress} scaleTo={0.97}>{Body}</PressableScale>;
}

const baseStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  check: { width: 24, height: 24, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  itemCol: { flex: 1, minWidth: 0 },
  name: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tempPill: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  tempPillText: { fontSize: 10, fontFamily: Fonts.bold },
  qtyMeta: { fontSize: FontSize.xs },
  priceCol: { alignItems: 'flex-end', minWidth: 60 },
  priceText: { fontSize: FontSize.xs, textAlign: 'right' },
  totalText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textAlign: 'right', marginTop: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  removeBtn: { paddingLeft: 4 },
});

// React.memo with a custom comparator (perf sweep 2026-07-15): shopping.tsx passes per-item
// inline closures, so a default shallow compare would never bail. Compare the data prop
// (`item`, kept by reference across unrelated store updates) plus the PRESENCE of the optional
// callbacks — their presence, not identity, is what drives rendering (onPress makes the row
// tappable; onIncrement/onDecrement show the stepper; onRemove shows the ×). The closures only
// ever act on this row's item, so keeping the previous render's closures is safe.
function monthlyRowPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.item === next.item &&
    prev.temporaryLabel === next.temporaryLabel &&
    !!prev.onPress === !!next.onPress &&
    !!prev.onIncrement === !!next.onIncrement &&
    !!prev.onDecrement === !!next.onDecrement &&
    !!prev.onRemove === !!next.onRemove
  );
}
export default React.memo(MonthlyTableRow, monthlyRowPropsEqual);
