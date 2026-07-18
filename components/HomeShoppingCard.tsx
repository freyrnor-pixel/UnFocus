/**
 * HomeShoppingCard.tsx — Home-screen preview of the current week's shopping list.
 *
 * Mirrors PlanTaskCard's Surface + domain-colored-border layout: shows the first 5 items
 * from "In list" in a collapsed preview, with an expand toggle to reveal "In list",
 * "In cart", and "Purchased" sections. Clicking the title navigates to the full
 * Shopping screen.
 *
 * Connections:
 *   Imports → components/Surface, components/ExpandableCard, components/FlightOverlay
 *             (FlightRect type only), components/ShoppingRow, components/PressableScale,
 *             components/ProgressBar, components/HomePreviewEmpty, constants/theme, lib/haptics,
 *             lib/i18n, lib/shoppingGroups (listProgress), lib/useAppTheme, lib/domainColor,
 *             expo-router, store/useShoppingStore (ShoppingItem type),
 *             store/useShoppingListStore (ShoppingList type)
 *   Used by → app/(tabs)/index.tsx (Home shopping preview)
 *   Data    → pure presentational; all mutations bubbled up via callbacks (parent owns the stores)
 *
 * Edit notes:
 *   - **Collapsed sizing (2026-07-13)**: `cardCollapsed` (minHeight:
 *     `HOME_PREVIEW_CARD_MIN_HEIGHT`, constants/theme.ts) is a compact shared *resting* floor
 *     applied only while `!expanded`, so this card reads the same size as
 *     HomeNotesCard/PlanTaskCard when light — then grows per item row above it;
 *     `previewRow`'s paddingVertical was trimmed to `Spacing.xs` for a slimmer collapsed row.
 *   - **Empty state**: an empty list renders the shared `HomePreviewEmpty` (icon disc +
 *     `t.shoppingEmpty`), filling the resting floor as one inviting block.
 *   - Collapsed preview shows the first 5 items from ungroupedUnchecked (In list only).
 *   - Expanded shows full nested structure with "In list" (ungrouped items),
 *     "In cart" (checked items), and "Purchased" sections.
 *   - Title click navigates to /shopping; no "See all →" button.
 *   - Drag-reorder is intentionally absent (needs parent screen hit-testing — Decision 011 R1).
 *   - `totalCount` comes from `listProgress()`'s `total` (matches the old ad-hoc sum) — reuse
 *     that helper rather than re-deriving it, since it's also the only correct way to count
 *     dish-group items as checked/unchecked (Decision 011a items don't live wholly in one
 *     bucket). The title row's progress bar uses the same call's `pct`, tinted with
 *     `getDomainColor(theme,'shop').accent`.
 *   - **Touch target (2026-07-11)**: the collapsed-preview check circle is visually 22x22
 *     but `hitSlop={13}` brings the tappable area to ~48dp, meeting Android's minimum
 *     touch-target size (the expanded/full-list rows reuse ShoppingRow, fixed separately).
 *   - **Flight animation (Phase 1, 2026-07-11)**: two destination anchors depending on mode —
 *     expanded rows (real `ShoppingRow`s) fly to the "In cart" section label (`cartHeaderRef`,
 *     always mounted whenever `checked.length > 0`); collapsed-preview rows (hand-rolled, not
 *     `ShoppingRow` — there's no "In cart" section mounted in that mode to fly to) fly to the
 *     card's own item-count badge instead (`badgeRef`) rather than forcing the card open —
 *     "some motion" is the bar, not a literal cross-section flight, per product direction.
 *     Both paths gate on `reducedMotion` and fall through to plain `onToggle()`.
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import ShoppingRow from '@/components/ShoppingRow';
import PressableScale from '@/components/PressableScale';
import HomePreviewEmpty from '@/components/HomePreviewEmpty';
import ProgressBar from '@/components/ProgressBar';
import type { FlightRect } from '@/components/FlightOverlay';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { ShoppingItem } from '@/store/useShoppingStore';
import { ShoppingList } from '@/store/useShoppingListStore';
import { listProgress } from '@/lib/shoppingGroups';
import { getDomainColor } from '@/lib/domainColor';

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
  /** See "Flight animation" edit note above. Omit to keep today's fade-only toggle. */
  onFlightStart?: (item: ShoppingItem, from: FlightRect, to: FlightRect) => void;
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
  onFlightStart,
}: Props) {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();
  const domainColor = getDomainColor(theme, 'shop');
  const [expanded, setExpanded] = useState(false);
  const cartHeaderRef = useRef<any>(null);
  const badgeRef = useRef<any>(null);
  const collapsedRowNodes = useRef<Map<string, any>>(new Map());

  const progress = listProgress({ dishGroups, ungroupedUnchecked, checked });
  const totalCount = progress.total;

  const previewItems = ungroupedUnchecked.slice(0, COLLAPSED_COUNT);
  const showToggle = ungroupedUnchecked.length > COLLAPSED_COUNT || checked.length > 0;

  function handleExpandedFlightStart(item: ShoppingItem, from: FlightRect) {
    if (!onFlightStart) return;
    const dest = cartHeaderRef.current;
    if (!dest?.measureInWindow) return; // "In cart" section not mounted yet — falls back to today's fade
    dest.measureInWindow((x: number, y: number, width: number, height: number) => {
      onFlightStart(item, from, { x, y, width, height });
    });
  }

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
          onFlightStart={variant === 'planned' ? (rect) => handleExpandedFlightStart(item, rect) : undefined}
        />
        {idx < total - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.surfaceMuted }]} />}
      </View>
    );
  }

  function handleTitlePress() {
    router.push('/shopping');
  }

  // Collapsed-preview rows are hand-rolled (not ShoppingRow) and have no "In cart" section
  // mounted to fly to — fly toward the card's own item-count badge instead, which is always
  // mounted whenever there's an item to toggle (totalCount counts regardless of checked state).
  function handleCollapsedToggle(item: ShoppingItem) {
    if (reducedMotion || !onFlightStart) { onToggle(item.id); return; }
    const rowNode = collapsedRowNodes.current.get(item.id);
    const badgeNode = badgeRef.current;
    if (!rowNode?.measureInWindow || !badgeNode?.measureInWindow) { onToggle(item.id); return; }
    rowNode.measureInWindow((x: number, y: number, width: number, height: number) => {
      badgeNode.measureInWindow((bx: number, by: number, bw: number, bh: number) => {
        onFlightStart(item, { x, y, width, height }, { x: bx, y: by, width: bw, height: bh });
        onToggle(item.id);
      });
    });
  }

  return (
    <Surface
      surfaceContext="ambient"
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>

        {/* Title row */}
        <PressableScale onPress={handleTitlePress} style={styles.titleRowPressable} scaleTo={0.97}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {list?.name ?? t.shoppingTitle}
            </Text>
            {totalCount > 0 && (
              <View ref={badgeRef} style={[styles.badge, { backgroundColor: domainColor.soft }]}>
                <Text style={[styles.badgeText, { color: domainColor.accent }]}>{totalCount}</Text>
              </View>
            )}
          </View>
          {totalCount > 0 && (
            <ProgressBar
              value={progress.pct}
              color={domainColor.accent}
              height={4}
              style={styles.progressBar}
            />
          )}
        </PressableScale>

        {totalCount === 0 ? (
          <HomePreviewEmpty icon="cart-outline" text={t.shoppingEmpty} domainColor={domainColor} />
        ) : expanded ? (
          // Expanded: full nested structure
          <View style={styles.rowsContainer}>
            <View style={styles.expandedBody}>
              {dishGroups.map(([dishName, groupItems]) => (
                <ExpandableCard
                  key={dishName}
                  title={dishName}
                  subtitle={t.ingredientsCount(groupItems.length)}
                  accentColor={domainColor.accent}
                  defaultOpen={false}
                >
                  {groupItems.map((item, idx) => renderShoppingRow(item, idx, groupItems.length, 'planned'))}
                </ExpandableCard>
              ))}

              {ungroupedUnchecked.length > 0 && (
                <View style={styles.shoppingSection}>
                  <Text style={[styles.sectionLabel, { color: domainColor.accent }]}>{t.inWeeklyListSection}</Text>
                  {ungroupedUnchecked.map((item, idx) => renderShoppingRow(item, idx, ungroupedUnchecked.length, 'planned'))}
                </View>
              )}

              {checked.length > 0 && (
                <View style={styles.shoppingSection}>
                  <Text ref={cartHeaderRef} style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.inKurvenSection(checked.length)}</Text>
                  {checked.map((item, idx) => renderShoppingRow(item, idx, checked.length, 'cart'))}
                </View>
              )}
            </View>
          </View>
        ) : (
          // Collapsed: flat preview rows
          <View style={styles.rowsContainer}>
            <View style={styles.rows}>
              {previewItems.map((item, idx) => (
                <View
                  key={item.id}
                  ref={(node) => {
                    if (node) collapsedRowNodes.current.set(item.id, node);
                    else collapsedRowNodes.current.delete(item.id);
                  }}
                >
                  {idx > 0 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                  <View style={styles.previewRow}>
                    <PressableScale
                      style={[
                        styles.check,
                        { borderColor: domainColor.accent },
                        item.checked && { backgroundColor: domainColor.accent },
                      ]}
                      onPress={() => handleCollapsedToggle(item)}
                      hitSlop={13}
                      scaleTo={0.97}
                    >
                      {item.checked && <Ionicons name="checkmark" size={12} color={theme.accentInk} />}
                    </PressableScale>
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
          <PressableScale
            style={styles.footerBtn}
            onPress={() => { tap(); setExpanded((v) => !v); }}
            scaleTo={0.97}
          >
            <Text style={[styles.footerBtnText, { color: theme.accent }]}>
              {expanded ? t.home.shoppingCollapse : t.home.shoppingExpand}
            </Text>
          </PressableScale>
        )}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Collapsed-only floor so Notes/Plans/Shopping read as the same size regardless of how
  // few items are in the list — see constants/theme.ts.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  cardContent: { flex: 1, padding: Spacing.md },
  titleRowPressable: { marginBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBar: { marginTop: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold, flexShrink: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  // Wells removed (2026-07-13 grouping pass): rows sit directly on the card face.
  rowsContainer: { marginBottom: Spacing.sm },
  rows: {},
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
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
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  expandedBody: { gap: 0 },
  shoppingSection: { gap: Spacing.xs, marginTop: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.xs },
});
