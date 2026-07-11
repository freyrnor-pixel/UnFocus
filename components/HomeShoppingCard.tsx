/**
 * HomeShoppingCard.tsx — Home-screen preview of the current week's shopping list.
 *
 * Mirrors PlanTaskCard's Surface + left-accent-bar layout: shows the first 5 items
 * from "In list" in a collapsed preview, with an expand toggle to reveal "In list",
 * "In cart", and "Purchased" sections. Clicking the title navigates to the full
 * Shopping screen.
 *
 * Connections:
 *   Imports → components/Surface, components/ExpandableCard, components/ShoppingRow,
 *             components/ProgressBar, constants/theme, lib/haptics, lib/i18n, lib/shoppingGroups
 *             (listProgress), lib/useAppTheme, expo-router, store/useShoppingStore (ShoppingItem
 *             type), store/useShoppingListStore (ShoppingList type)
 *   Used by → app/(tabs)/index.tsx (Home shopping preview)
 *   Data    → pure presentational; all mutations bubbled up via callbacks (parent owns the stores)
 *
 * Edit notes:
 *   - Collapsed preview shows the first 5 items from ungroupedUnchecked (In list only).
 *   - Expanded shows full nested structure with "In list" (ungrouped items),
 *     "In cart" (checked items), and "Purchased" sections.
 *   - Title click navigates to /shopping; no "See all →" button.
 *   - Drag-reorder is intentionally absent (needs parent screen hit-testing — Decision 011 R1).
 *   - `totalCount` comes from `listProgress()`'s `total` (matches the old ad-hoc sum) — reuse
 *     that helper rather than re-deriving it, since it's also the only correct way to count
 *     dish-group items as checked/unchecked (Decision 011a items don't live wholly in one
 *     bucket). The title row's progress bar uses the same call's `pct`, tinted `featShop`.
 *   - **Touch target (2026-07-11)**: the collapsed-preview check circle is visually 22x22
 *     but `hitSlop={13}` brings the tappable area to ~48dp, meeting Android's minimum
 *     touch-target size (the expanded/full-list rows reuse ShoppingRow, fixed separately).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import ShoppingRow from '@/components/ShoppingRow';
import ProgressBar from '@/components/ProgressBar';
import { FontSize, Fonts, Radius, Spacing, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { ShoppingItem } from '@/store/useShoppingStore';
import { ShoppingList } from '@/store/useShoppingListStore';
import { listProgress } from '@/lib/shoppingGroups';

const COLLAPSED_COUNT = 5;

type Props = {
  list?: ShoppingList | null;
  dishGroups: [string, ShoppingItem[]][];
  ungroupedUnchecked: ShoppingItem[];
  checked: ShoppingItem[];
  onToggle: (id: string) => void;
  onCollect: (id: string) => void;
  onRemove: (item: ShoppingItem) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onNavigateToShopping: () => void;
  inStockLabel: string;
};

export default function HomeShoppingCard({
  list,
  dishGroups,
  ungroupedUnchecked,
  checked,
  onToggle,
  onCollect,
  onRemove,
  onIncrement,
  onDecrement,
  onNavigateToShopping,
  inStockLabel,
}: Props) {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const [expanded, setExpanded] = useState(false);

  const progress = listProgress({ dishGroups, ungroupedUnchecked, checked });
  const totalCount = progress.total;

  const previewItems = ungroupedUnchecked.slice(0, COLLAPSED_COUNT);
  const showToggle = ungroupedUnchecked.length > COLLAPSED_COUNT || checked.length > 0;

  function renderShoppingRow(item: ShoppingItem, idx: number, total: number, variant: 'planned' | 'cart') {
    return (
      <View key={item.id}>
        <ShoppingRow
          item={item}
          variant={variant}
          onToggle={() => onToggle(item.id)}
          onCollect={variant === 'cart' ? () => onCollect(item.id) : undefined}
          onRemove={() => onRemove(item)}
          onIncrement={() => onIncrement(item.id)}
          onDecrement={() => onDecrement(item.id)}
          inStockLabel={inStockLabel}
        />
        {idx < total - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.surfaceMuted }]} />}
      </View>
    );
  }

  function handleTitlePress() {
    router.push('/shopping');
  }

  return (
    <Surface surfaceContext="ambient" style={[styles.card, styles.cardRow]}>
      <View style={[styles.accent, { backgroundColor: theme.featShop }]} />
      <View style={styles.cardContent}>

        {/* Title row */}
        <Pressable onPress={handleTitlePress} style={styles.titleRowPressable}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {list?.name ?? t.shoppingTitle}
            </Text>
            {totalCount > 0 && (
              <View style={[styles.badge, { backgroundColor: rgba(theme.featShop, 0.16) }]}>
                <Text style={[styles.badgeText, { color: theme.featShop }]}>{totalCount}</Text>
              </View>
            )}
          </View>
          {totalCount > 0 && (
            <ProgressBar
              value={progress.pct}
              color={theme.featShop}
              height={4}
              style={styles.progressBar}
            />
          )}
        </Pressable>

        {totalCount === 0 ? (
          <View style={[styles.rowsContainer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.shoppingEmpty}</Text>
          </View>
        ) : expanded ? (
          // Expanded: full nested structure
          <View style={[styles.rowsContainer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <View style={styles.expandedBody}>
              {dishGroups.map(([dishName, groupItems]) => (
                <ExpandableCard
                  key={dishName}
                  title={dishName}
                  subtitle={t.ingredientsCount(groupItems.length)}
                  accentColor={theme.featShop}
                  defaultOpen={false}
                >
                  {groupItems.map((item, idx) => renderShoppingRow(item, idx, groupItems.length, 'planned'))}
                </ExpandableCard>
              ))}

              {ungroupedUnchecked.length > 0 && (
                <View style={styles.shoppingSection}>
                  <Text style={[styles.sectionLabel, { color: theme.featShop }]}>{t.inWeeklyListSection}</Text>
                  {ungroupedUnchecked.map((item, idx) => renderShoppingRow(item, idx, ungroupedUnchecked.length, 'planned'))}
                </View>
              )}

              {checked.length > 0 && (
                <View style={styles.shoppingSection}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.inKurvenSection(checked.length)}</Text>
                  {checked.map((item, idx) => renderShoppingRow(item, idx, checked.length, 'cart'))}
                </View>
              )}
            </View>
          </View>
        ) : (
          // Collapsed: flat preview rows
          <View style={[styles.rowsContainer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <View style={styles.rows}>
              {previewItems.map((item, idx) => (
                <View key={item.id}>
                  {idx > 0 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                  <View style={styles.previewRow}>
                    <Pressable
                      style={[
                        styles.check,
                        { borderColor: theme.featShop },
                        item.checked && { backgroundColor: theme.featShop },
                      ]}
                      onPress={() => onToggle(item.id)}
                      hitSlop={13}
                    >
                      {item.checked && <Ionicons name="checkmark" size={12} color={theme.accentInk} />}
                    </Pressable>
                    <Text
                      style={[
                        styles.previewName,
                        { color: item.checked ? theme.textMuted : theme.text },
                        item.checked && { textDecorationLine: 'line-through' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {!!item.amount && (
                      <Text style={[styles.previewAmount, { color: theme.textMuted }]} numberOfLines={1}>
                        {item.amount}{item.unit ? ` ${item.unit}` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Expand/collapse toggle */}
        {showToggle && (
          <Pressable
            style={styles.footerBtn}
            onPress={() => { tap(); setExpanded((v) => !v); }}
          >
            <Text style={[styles.footerBtnText, { color: theme.accent }]}>
              {expanded ? t.home.shoppingCollapse : t.home.shoppingExpand}
            </Text>
          </Pressable>
        )}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  cardRow: { flexDirection: 'row' },
  accent: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  cardContent: { flex: 1, padding: Spacing.md },
  titleRowPressable: { marginBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBar: { marginTop: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold, flexShrink: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  rowsContainer: { borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.sm, marginBottom: Spacing.sm },
  rows: {},
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.regular },
  previewAmount: { fontSize: FontSize.xs, fontFamily: Fonts.regular },
  rowDivider: { height: 1 },
  emptyText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.sm },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  expandedBody: { gap: 0 },
  shoppingSection: { gap: Spacing.xs, marginTop: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.xs },
});
