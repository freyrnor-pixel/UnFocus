/**
 * AddFromMonthlyModal.tsx — centered popup for picking monthly-catalog items to add to a
 * weekly list.
 *
 * Replaces the old in-card inline "from monthly" panel (WeekListCard.tsx) with a real
 * `Modal` popped up in the middle of the screen over a backdrop, following the same shell
 * `components/AppModal.tsx` uses (transparent Modal + backdrop dismiss + Animated scale/opacity
 * entrance + `Surface surfaceContext="overlay"` card) but sized for a scrollable list instead of
 * a small alert. The user scrolls the whole monthly catalog (now potentially several named
 * Monthly lists — Shopping/Monthly redesign 2026-07-22), checks off however many items they
 * want across any of them, then commits them all in one batch via the footer's "Add (n)"
 * button — nothing is added to the weekly list until that button is pressed, so Cancel needs
 * no rollback/undo logic.
 *
 * Connections:
 *   Imports → components/PressableScale, components/ShoppingFilterBar, components/Surface,
 *             components/FormControls (Checkbox), constants/theme, lib/i18n, lib/money (formatKr),
 *             lib/useAppTheme, react-native-reanimated, store/useShoppingStore (ShoppingItem type),
 *             store/useMonthlyListStore (MonthlyList type)
 *   Used by → components/WeekListCard.tsx (rendered once per card, replacing the inline panel)
 *   Data    → none directly — `items`/`lists` and the batch `onAdd` callback are owned by the parent
 *
 * Edit notes:
 *   - Local `selectedIds`/search/category state resets every time `visible` flips false→true
 *     (mirrors `MonthlyResetReviewSheet`'s `wasVisible` reset-on-reopen idiom) so a previous
 *     session's selection never leaks into the next time this list's "Add from monthly" opens.
 *   - Timing/easing follow ANIMATION_GUIDELINES.md's modal enter/exit band (320ms ease-out in /
 *     220ms ease-in out), gated by useAccessibility().reducedMotion — same as AppModal.tsx.
 *   - **Grouped-by-list (2026-07-22)**: items are sectioned under each Monthly list's own name
 *     header, stacked in vertical order (`lists` prop order — store/useMonthlyListStore.ts's
 *     sortOrder) — "a scrollable preview of the Monthly list[s] with the different lists in
 *     vertical order." A section is skipped entirely once that list has zero items surviving
 *     the shared search/category filter. Selection/commit stays flat across all lists — the
 *     footer's "Add (n)" counts and adds every checked item regardless of which section it's in.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { formatKr } from '@/lib/money';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import ShoppingFilterBar from '@/components/ShoppingFilterBar';
import { Checkbox } from '@/components/FormControls';
import { ShoppingItem } from '@/store/useShoppingStore';
import { MonthlyList } from '@/store/useMonthlyListStore';

type Props = {
  visible: boolean;
  items: ShoppingItem[];
  /** Every Monthly list, in display order — used to section `items` under a name header. */
  lists: MonthlyList[];
  onAdd: (items: ShoppingItem[]) => void;
  onClose: () => void;
};

export default function AddFromMonthlyModal({ visible, items, lists, onAdd, onClose }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const wasVisible = useRef(visible);
  if (visible && !wasVisible.current) {
    setSearch('');
    setCategory(null);
    setSelectedIds(new Set());
  }
  wasVisible.current = visible;

  const progress = useSharedValue(visible ? 1 : 0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reducedMotion ? 1 : withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else if (reducedMotion) {
      progress.value = 0;
      setMounted(false);
    } else {
      progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, reducedMotion, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  if (!mounted) return null;

  const q = search.trim().toLowerCase();
  const filteredItems = items.filter(
    (i) => (!q || i.name.toLowerCase().includes(q)) && (category == null || i.category === category)
  );
  // Section the filtered items under each Monthly list's own name, in list display order —
  // skips a list entirely once it has no surviving items (no empty section headers).
  const sections = lists
    .map((list) => ({ list, listItems: filteredItems.filter((i) => i.monthlyListId === list.id) }))
    .filter((s) => s.listItems.length > 0);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const selected = items.filter((i) => selectedIds.has(i.id));
    if (selected.length > 0) onAdd(selected);
    onClose();
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Surface surfaceContext="overlay" style={styles.card}>
            <Text style={[styles.title, { color: theme.text }]}>{t.fromMonthlySection}</Text>

            <ShoppingFilterBar
              search={search}
              onSearchChange={setSearch}
              category={category}
              onCategoryChange={setCategory}
              placeholder={t.monthlyPreviewSearchPlaceholder}
            />

            {sections.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textMuted }]}>{t.monthlyPreviewEmpty}</Text>
            ) : (
              <ScrollView style={styles.scroll}>
                {sections.map(({ list, listItems }, sectionIdx) => (
                  <View key={list.id} style={sectionIdx > 0 && styles.sectionSpacing}>
                    <Text style={[styles.sectionHeader, { color: theme.textMuted }]} numberOfLines={1}>
                      {list.name}
                    </Text>
                    {listItems.map((item, idx) => {
                      const lineTotal = item.price > 0 ? item.price * (parseInt(item.amount, 10) || 1) : null;
                      return (
                        <View key={item.id}>
                          <View style={styles.row}>
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelected(item.id)}
                              label={item.name}
                            />
                            {lineTotal !== null && (
                              <Text style={[styles.rowPrice, { color: theme.textMuted }]}>{formatKr(lineTotal, 0)}</Text>
                            )}
                          </View>
                          {idx < listItems.length - 1 && (
                            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.footer}>
              <PressableScale
                style={[styles.footerBtn, { backgroundColor: theme.good, opacity: selectedIds.size === 0 ? 0.5 : 1 }]}
                onPress={handleAdd}
                disabled={selectedIds.size === 0}
                scaleTo={0.95}
              >
                <Text style={[styles.footerBtnText, { color: theme.textInverse }]}>
                  {t.addSelectedItemsBtn(selectedIds.size)}
                </Text>
              </PressableScale>
              <PressableScale
                style={[styles.footerBtn, { backgroundColor: theme.surfaceMuted }]}
                onPress={onClose}
                scaleTo={0.97}
              >
                <Text style={[styles.footerBtnText, { color: theme.textMuted }]}>{t.cancel}</Text>
              </PressableScale>
            </View>
          </Surface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  scroll: { flexGrow: 0 },
  empty: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.md },
  sectionHeader: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  sectionSpacing: { marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: Spacing.sm,
  },
  rowPrice: { fontSize: FontSize.xs },
  rowDivider: { height: 1 },
  footer: { flexDirection: 'row', gap: Spacing.sm },
  footerBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  footerBtnText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
});
