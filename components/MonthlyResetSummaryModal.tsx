/**
 * MonthlyResetSummaryModal.tsx — read-only recap shown right after the payday-boundary reset.
 *
 * Displays the MonthlyResetSummary snapshot useShoppingStore.buildMonthlyResetSummary()
 * captured just before monthlyReset() wiped purchasedAt/shoppingTripId off the items it
 * read: inventory-sourced spend vs the full inventory's standing value, and a separate
 * chronological list of ad-hoc (non-inventory) purchases. Entirely non-editable — no
 * delete/edit affordances, this is a recap, not a list to manage.
 *
 * Connections:
 *   Imports → components/Surface, constants/theme, lib/i18n, lib/useAppTheme,
 *             store/useShoppingStore (types only)
 *   Used by → app/shopping.tsx
 *   Data    → none directly — renders the MonthlyResetSummary object passed in by the parent
 *
 * Edit notes:
 *   - Both inventoryItems and adHocItems arrive already sorted chronologically by
 *     purchasedAt (oldest first) from the store — don't re-sort here.
 *   - purchasedAt is a full ISO datetime (doneShopping stamps it via `new Date().toISOString()`),
 *     so this only ever renders its first 10 chars (the YYYY-MM-DD date portion).
 *   - Ported (2026-07-02, Session A2·2, expanded scope — see PROGRESS_LOG). Rebuilt on
 *     `<Surface surfaceContext="overlay">` instead of the old repo's bare `View` +
 *     `theme.white` + `Shadow.fab` — same rationale as SavedListsModal.tsx. `theme` prop
 *     dropped in favor of internal useAppTheme(). Token remap (Decision 006): text→text,
 *     textLight→textMuted, orange(section label/close btn)→accent, hardcoded fontWeight
 *     → Fonts tokens.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import { MonthlyResetSummary } from '@/store/useShoppingStore';

type Props = {
  visible: boolean;
  summary: MonthlyResetSummary | null;
  onClose: () => void;
};

export default function MonthlyResetSummaryModal({ visible, summary, onClose }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  if (!summary) return null;
  const isEmpty = summary.inventoryItems.length === 0 && summary.adHocItems.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.monthlyResetSummaryTitle}</Text>

        {isEmpty ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.monthlyResetSummaryEmpty}</Text>
        ) : (
          <ScrollView style={styles.scroll}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.accent }]}>{t.monthlyResetSummaryInventorySection}</Text>
              <View style={styles.totalsRow}>
                <Text style={[styles.spentText, { color: theme.text }]}>
                  {t.monthlyResetSummarySpentLabel(summary.inventorySpent.toFixed(0))}
                </Text>
                <Text style={[styles.ofTotalText, { color: theme.textMuted }]}>
                  {t.monthlyResetSummaryOfTotalLabel(summary.inventoryTotalValue.toFixed(0))}
                </Text>
              </View>
              {summary.inventoryItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.itemMeta, { color: theme.textMuted }]}>{(item.purchasedAt ?? '').slice(0, 10)}</Text>
                  {item.price > 0 && (
                    <Text style={[styles.itemPrice, { color: theme.textMuted }]}>{item.price.toFixed(0)} kr</Text>
                  )}
                </View>
              ))}
            </View>

            {summary.adHocItems.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.monthlyResetSummaryAdHocSection}</Text>
                {summary.adHocItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.itemMeta, { color: theme.textMuted }]}>{(item.purchasedAt ?? '').slice(0, 10)}</Text>
                    {item.price > 0 && (
                      <Text style={[styles.itemPrice, { color: theme.textMuted }]}>{item.price.toFixed(0)} kr</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        <Pressable style={[styles.closeBtn, { backgroundColor: theme.accent }]} onPress={onClose}>
          <Text style={[styles.closeBtnText, { color: theme.accentInk }]}>{t.monthlyResetSummaryCloseBtn}</Text>
        </Pressable>
      </Surface>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '80%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
  scroll: { marginBottom: Spacing.sm },
  section: { marginBottom: Spacing.md },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  totalsRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, marginBottom: Spacing.xs },
  spentText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  ofTotalText: { fontSize: FontSize.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  itemName: { flex: 1, fontSize: FontSize.sm },
  itemMeta: { fontSize: FontSize.xs },
  itemPrice: { fontSize: FontSize.xs, minWidth: 50, textAlign: 'right' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },
  closeBtn: { borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  closeBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
