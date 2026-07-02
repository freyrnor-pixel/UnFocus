/**
 * MonthlyTableRow.tsx — Katalog row (permanent inventory item).
 *
 * Renders one Katalog item in the consolidated "Item | Price per unit | x Amount |
 * Total cost" format: a leading checkbox that flags pendingRestock (stages it into
 * the weekly staging tray, independent of `status`), the name (with a "Midlertidig"
 * pill badge when isTemporary), the target quantity, the per-unit price, and the
 * computed total (price × quantity). Tapping the row body opens the Update Sheet
 * when `onPress` is given — `onPress` is undefined while the Monthly Container
 * (app/shopping.tsx) is locked, so rows are inert in that state; unlocking it (or
 * the standalone inventory-edit screen) wires `onPress` and rows become tappable.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, store/useShoppingStore
 *   Used by → app/shopping.tsx (Monthly catalog tab); app/inventory-edit.tsx not yet ported
 *   Data    → consumes the ShoppingItem type from useShoppingStore; mutations happen in the parent via onTogglePending/onPress; scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - There is no inline +/- stepper any more — targetQuantity is only ever
 *     edited via the Update Sheet (components/UpdateSheet.tsx).
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
 *   - `theme` is no longer threaded in as a prop (dropped the old `theme: AppColors`
 *     prop) — reads useAppTheme() internally, consistent with every other ported
 *     component.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingItem } from '@/store/useShoppingStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  item: ShoppingItem;
  onTogglePending: () => void;
  onPress?: () => void;
  temporaryLabel?: string;
};

export default function MonthlyTableRow({ item, onTogglePending, onPress, temporaryLabel }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const total = item.price > 0 ? item.price * item.targetQuantity : null;

  const Body = (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <Pressable
        style={[styles.check, { borderColor: theme.accent }, item.pendingRestock && { backgroundColor: theme.accent, borderColor: theme.accent }]}
        onPress={onTogglePending}
        hitSlop={6}
      >
        {item.pendingRestock && <Ionicons name="checkmark" size={14} color={theme.accentInk} />}
      </Pressable>

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
          <Text style={[styles.qtyMeta, { color: theme.textMuted }]}>×{item.targetQuantity}</Text>
        </View>
      </View>

      <View style={styles.priceCol}>
        <Text style={[styles.priceText, { color: theme.textMuted }]}>
          {item.price > 0 ? `${item.price.toFixed(0)} kr` : '—'}
        </Text>
        {total !== null && (
          <Text style={[styles.totalText, { color: theme.text }]}>{`= ${total.toFixed(0)} kr`}</Text>
        )}
      </View>
    </View>
  );

  if (!onPress) return Body;
  return <Pressable onPress={onPress}>{Body}</Pressable>;
}

const baseStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  check: { width: 24, height: 24, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  itemCol: { flex: 1, minWidth: 0 },
  name: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tempPill: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  tempPillText: { fontSize: 10, fontWeight: '700' },
  qtyMeta: { fontSize: FontSize.xs },
  priceCol: { alignItems: 'flex-end', minWidth: 60 },
  priceText: { fontSize: FontSize.xs, textAlign: 'right' },
  totalText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textAlign: 'right', marginTop: 1 },
});
