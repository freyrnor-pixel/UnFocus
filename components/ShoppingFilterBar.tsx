/**
 * ShoppingFilterBar.tsx — shared "search by name + filter by category" bar for shopping lists.
 *
 * A `TextInput` (name search) plus a category-picker button that reuses the existing
 * `showAppModal` chooser idiom (same pattern as WeekListCard's kebab "list options" menu)
 * instead of a new dropdown/menu component. Purely controlled — the caller owns
 * search/category state and does its own `.filter()` over its item list; this component
 * only renders the bar and the category chooser.
 *
 * Connections:
 *   Imports → components/AppModal (showAppModal), components/PressableScale, constants/theme,
 *             lib/i18n (useT), lib/shoppingCategories (categoryPresets, categoryLabel),
 *             lib/useAppTheme, @expo/vector-icons
 *   Used by → components/WeekListCard.tsx (per-list Weekly filter), components/AddFromMonthlyModal.tsx,
 *             app/(tabs)/shopping.tsx (Monthly tab filter)
 *   Data    → none — fully controlled by the caller's search/category state
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { categoryLabel, categoryPresets } from '@/lib/shoppingCategories';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  category: string | null;
  onCategoryChange: (v: string | null) => void;
  placeholder: string;
};

export default function ShoppingFilterBar({ search, onSearchChange, category, onCategoryChange, placeholder }: Props) {
  const theme = useAppTheme();
  const t = useT();

  function openCategoryChooser() {
    showAppModal(t.categoryPickerLabel, undefined, [
      { text: t.categoryFilterAllLabel, onPress: () => onCategoryChange(null) },
      ...categoryPresets(t).map((preset) => ({ text: preset.label, onPress: () => onCategoryChange(preset.value) })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  const categoryText = category ? categoryLabel(t, category) : t.categoryFilterAllLabel;

  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.search, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
        value={search}
        onChangeText={onSearchChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
      />
      <PressableScale
        style={[styles.categoryBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        onPress={openCategoryChooser}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={t.categoryFilterAccessibilityLabel}
      >
        <Text style={[styles.categoryBtnText, { color: theme.text }]} numberOfLines={1}>
          {categoryText}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  search: {
    flex: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
    minHeight: 44,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    minHeight: 44,
    maxWidth: 140,
  },
  categoryBtnText: { fontSize: FontSize.sm },
});
