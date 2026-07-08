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
 *             constants/theme, lib/haptics, lib/i18n, lib/useAppTheme, expo-router,
 *             store/useShoppingStore (ShoppingItem type), store/useShoppingListStore (ShoppingList type)
 *   Used by → app/(tabs)/index.tsx (Home shopping preview)
 *   Data    → pure presentational; all mutations bubbled up via callbacks (parent owns the stores)
 *
 * Edit notes:
 *   - Collapsed preview shows the first 5 items from ungroupedUnchecked (In list only).
 *   - Expanded shows full nested structure with "In list" (ungrouped items),
 *     "In cart" (checked items), and "Purchased" sections.
 *   - Title click navigates to /shopping; no "See all →" button.
 *   - Drag-reorder is intentionally absent (needs parent screen hit-testing — Decision 011 R1).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import ShoppingRow from '@/components/ShoppingRow';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { ShoppingItem } from '@/store/useShoppingStore';
import { ShoppingList } from '@/store/useShoppingListStore';

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

  const totalCount =
    dishGroups.reduce((n, [, g]) => n + g.length, 0) +
    ungroupedUnchecked.length +
    checked.length;

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
              <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>{totalCount}</Text>
              </View>
            )}
          </View>
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
                      hitSlop={8}
                    >
                      {item.checked && <Ionicons name="checkmark" size={12} color={theme.bg} />}
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
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold, flexShrink: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  rowsContainer: { borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.sm, marginBottom: Spacing.sm },
  rows: {},
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  check: {
    width: 20,
    height: 20,
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
