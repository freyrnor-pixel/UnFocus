/**
 * HomeShoppingCard.tsx — Home-screen preview of the current week's shopping list.
 *
 * Mirrors PlanTaskCard's Surface + domain-colored-border layout: shows the first 5 items
 * from "In list" in a collapsed preview, with an expand toggle to reveal "In list",
 * "In cart", and "Purchased" sections. Clicking the title navigates to the full
 * Shopping screen.
 *
 * Connections:
 *   Imports → components/Surface, components/ExpandableCard, components/CardAccent
 *             (badge+wash gradient move), components/FlightOverlay
 *             (FlightRect type only), components/ShoppingRow, components/PressableScale,
 *             components/ProgressBar, components/HomePreviewEmpty, components/AddRow +
 *             components/Stepper (quick-add's inline quantity/target extras), constants/theme,
 *             lib/haptics, lib/i18n, lib/shoppingGroups (listProgress), lib/useAppTheme,
 *             lib/domainColor, lib/budget (SpendPace type only), expo-router,
 *             store/useShoppingStore (ShoppingItem type), store/useShoppingListStore
 *             (ShoppingList type)
 *   Used by → app/(tabs)/index.tsx (Home shopping preview)
 *   Data    → pure presentational; all mutations bubbled up via callbacks (parent owns the stores);
 *             the `pace` prop is likewise computed by the parent (lib/budget.ts's computeSpendPace())
 *
 * Edit notes:
 *   - **Collapsed sizing (2026-07-13)**: `cardCollapsed` (minHeight:
 *     `HOME_PREVIEW_CARD_MIN_HEIGHT`, constants/theme.ts) is a compact shared *resting* floor
 *     applied only while `!expanded`, so this card reads the same size as
 *     HomeNotesCard/PlanTaskCard when light — then grows per item row above it;
 *     `previewRow`'s paddingVertical was trimmed to `Spacing.xs` for a slimmer collapsed row.
 *   - **Empty state**: an empty list renders the shared `HomePreviewEmpty` (left-aligned
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
 *   - **Spend-pace line (2026-07-22)**: an optional `pace` prop (Decision 026 — actual kr/day
 *     spent since lastMonthlyReset vs. budgeted kr/day for the payday-to-payday period) renders
 *     right under the title row's progress bar, tinted `theme.warn`/`theme.good` same as
 *     app/budget.tsx's own pace row (never `bad`/red, no-shame rule). Omitted entirely when the
 *     parent passes null/undefined (no budget set yet, or no monthly reset has happened).
 *   - **Flight animation (Phase 1, 2026-07-11)**: two destination anchors depending on mode —
 *     expanded rows (real `ShoppingRow`s) fly to the "In cart" section label (`cartHeaderRef`,
 *     always mounted whenever `checked.length > 0`); collapsed-preview rows (hand-rolled, not
 *     `ShoppingRow` — there's no "In cart" section mounted in that mode to fly to) fly to the
 *     card's own item-count badge instead (`badgeRef`) rather than forcing the card open —
 *     "some motion" is the bar, not a literal cross-section flight, per product direction.
 *     Both paths gate on `reducedMotion` and fall through to plain `onToggle()`.
 *   - **Badge pinned (2026-07-24)**: `CardAccentBadge` is absolutely positioned (`badgeFixed`)
 *     instead of inline in `titleRow` — see the JSX comment at the header block.
 *   - **Badge/wash moved outside cardContent's padding (2026-07-24, follow-up — user report,
 *     screenshot)**: `badgeFixed`'s `top`/`left` used to be plain `0`, with `cardContent`'s own
 *     padding relied on to inset it — except React Native's real (native) behavior is that an
 *     absolutely-positioned child DOES inherit its parent's padding as part of its origin
 *     (confirmed by `CardAccentWash`'s pre-existing `-Spacing.md` bleed, which exists purely to
 *     cancel that same inheritance) — while react-native-web (this repo's headless preview
 *     tooling) does NOT reproduce that inheritance, since it compiles straight to CSS, where the
 *     absolute containing block is the padding *edge*, not the content box. Testing changes here
 *     against the web preview alone is actively misleading for this exact interaction. Setting
 *     `top: Spacing.md, left: Spacing.md` on top of `cardContent`'s own padding "fixed" it on web
 *     but doubled the inset on native (compounded: 16 inherited + 16 explicit = 32), which read as
 *     the badge floating away from the corner instead of framing it. Fix: `CardAccentWash` and
 *     `CardAccentBadge` now mount as siblings of `cardContent` (not children of it), directly
 *     inside `Surface` — which itself adds no padding of its own (see Surface.tsx: padding keys in
 *     the `style` prop route to its inner content view, and `card`'s style here carries none) — so
 *     their `top`/`left` offsets are unambiguous on both platforms; no padding-inheritance question
 *     to get wrong. `cardContent` keeps its own padding for its own (flow) children unchanged.
 *   - **Quick-add (2026-07-24)**: previously this card had no add affordance at all — items
 *     could only be toggled/adjusted, not created. A trailing `AddRow` (gated on the optional
 *     `onAddItem` callback, same "gate on the callback" convention as PlanTaskCard's own
 *     quick-add) renders below the rows/empty-state in all three modes (empty/collapsed/
 *     expanded). Its `extras` carry the two essential settings: a `Stepper` quantity (1–99)
 *     and a target chip that cycles Weekly (the `list` prop, i.e. "this week") → each entry in
 *     `monthlyLists` → back to Weekly. `onAddItem(name, quantity, monthlyListId?)` — an absent
 *     `monthlyListId` means "the current week's list"; the caller (Home) owns turning that into
 *     the right `ShoppingItemInput` shape (status `inWeeklyList` vs `catalog`), same split
 *     app/(tabs)/shopping.tsx already makes between its Week and Monthly tabs. Both qty and
 *     target reset to their defaults after each commit.
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import { CardAccentBadge, CardAccentWash } from '@/components/CardAccent';
import ShoppingRow from '@/components/ShoppingRow';
import PressableScale from '@/components/PressableScale';
import HomePreviewEmpty from '@/components/HomePreviewEmpty';
import ProgressBar from '@/components/ProgressBar';
import AddRow from '@/components/AddRow';
import Stepper from '@/components/Stepper';
import type { FlightRect } from '@/components/FlightOverlay';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { ShoppingItem } from '@/store/useShoppingStore';
import { ShoppingList } from '@/store/useShoppingListStore';
import { listProgress } from '@/lib/shoppingGroups';
import { getDomainColor } from '@/lib/domainColor';
import { SpendPace } from '@/lib/budget';

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
  /** Spend-vs-budget pace (Decision 026, lib/budget.ts's computeSpendPace()) — null/undefined
   *  hides the line (no budget set yet, or no monthly reset has happened). */
  pace?: SpendPace | null;
  /** Inline quick-add (2026-07-24) — see the Edit notes' "Quick-add" entry above. Omit to
   *  render the card with no add affordance (its pre-2026-07-24 behavior). */
  onAddItem?: (name: string, quantity: number, monthlyListId?: string) => void;
  /** Target chip's cycle options beyond "this week" — id/name is all it needs. */
  monthlyLists?: { id: string; name: string }[];
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
  pace,
  onAddItem,
  monthlyLists = [],
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

  // Quick-add — see the Edit notes' "Quick-add" entry above. addTargetIndex 0 = weekly (the
  // `list` prop); i>0 = monthlyLists[i-1].
  const [addDraft, setAddDraft] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addTargetIndex, setAddTargetIndex] = useState(0);

  function cycleAddTarget() {
    tap();
    setAddTargetIndex((i) => (i + 1) % (monthlyLists.length + 1));
  }

  function commitAdd() {
    const name = addDraft.trim();
    if (!name || !onAddItem) return;
    const monthlyListId = addTargetIndex > 0 ? monthlyLists[addTargetIndex - 1]?.id : undefined;
    onAddItem(name, addQty, monthlyListId);
    setAddDraft('');
    setAddQty(1);
    setAddTargetIndex(0);
  }

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
      borderColor={domainColor.accent}
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      {/* Header wash + badge mount OUTSIDE cardContent, directly in Surface — see the
          "Badge/wash moved outside cardContent's padding" edit note above for why. */}
      <CardAccentWash domain="shop" />
      <CardAccentBadge domain="shop" size={32} style={styles.badgeFixed} />
      <View style={styles.cardContent}>
        {/* Title row */}
        <PressableScale onPress={handleTitlePress} style={styles.titleRowPressable} scaleTo={0.97}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {list?.name ?? t.shoppingTitle}
            </Text>
            {totalCount > 0 && (
              <View ref={badgeRef} style={[styles.badge, { backgroundColor: domainColor.soft, borderColor: rgba(domainColor.accent, 0.4) }]}>
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

        {pace && (
          <Text
            style={[styles.paceText, { color: pace.overPace ? theme.warn : theme.good }]}
            numberOfLines={1}
          >
            {t.budget.perDaySpend(String(Math.round(pace.actualPerDay)), String(Math.round(pace.budgetedPerDay)))}
          </Text>
        )}

        {totalCount === 0 ? (
          <HomePreviewEmpty text={t.shoppingEmpty} domainColor={domainColor} />
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

        {/* Inline quick-add — see the Edit notes' "Quick-add" entry above. Renders whether the
            list is empty, collapsed, or expanded (gated on `onAddItem`, not on any of those
            three modes). */}
        {onAddItem ? (
          <AddRow
            placeholder={t.shoppingItemPlaceholder}
            value={addDraft}
            onChangeText={setAddDraft}
            onSubmit={commitAdd}
            accent={domainColor.accent}
            accessibilityLabel={t.shoppingItemPlaceholder}
            confirmIcon="checkmark"
            extras={
              <>
                <Stepper value={addQty} onChange={setAddQty} min={1} max={99} accessibilityLabel={t.home.quantityLabel} />
                <PressableScale
                  style={[styles.targetChip, { borderColor: domainColor.accent }]}
                  onPress={cycleAddTarget}
                  hitSlop={8}
                  scaleTo={0.95}
                  accessibilityRole="button"
                  accessibilityLabel={addTargetIndex === 0 ? t.home.weeklyListChip : monthlyLists[addTargetIndex - 1]?.name}
                >
                  <Ionicons
                    name={addTargetIndex === 0 ? 'calendar-outline' : 'file-tray-full-outline'}
                    size={13}
                    color={domainColor.accent}
                  />
                  <Text style={[styles.targetChipText, { color: domainColor.accent }]} numberOfLines={1}>
                    {addTargetIndex === 0 ? t.home.weeklyListChip : monthlyLists[addTargetIndex - 1]?.name}
                  </Text>
                </PressableScale>
              </>
            }
          />
        ) : null}

        {/* Expand/collapse toggle */}
        {showToggle && (
          <PressableScale
            style={styles.footerBtn}
            onPress={() => { tap(); setExpanded((v) => !v); }}
            scaleTo={0.97}
          >
            <Text style={[styles.footerBtnText, { color: domainColor.accent }]}>
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
  // paddingTop Spacing.md (was Spacing.sm) so the header sits VERTICALLY CENTERED in the 64px
  // CardAccentWash band instead of hugging the top edge — matches PlanTaskCard's 2026-07-24 fix
  // for "title too high, not centered between the top border and the wash divider".
  cardContent: { flex: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: Spacing.md },
  // marginBottom Spacing.md (was .sm) so the content starts at the 64px wash divider — see the
  // CardAccentWash comment above.
  titleRowPressable: { marginBottom: Spacing.md },
  // paddingLeft (badge offset 16 + badge size 32 + gap 8 = 56) clears the fixed badge
  // (badgeFixed below) — the badge no longer sits inline here, see the edit note above.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: 56 },
  // Takes the badge out of flex flow so its position is fixed regardless of sibling content
  // height (e.g. a scaled-up title at large accessibility text sizes) — see edit note above.
  // Mounts as a sibling of cardContent now (not a child of it), directly in the unpadded
  // Surface — see the "Badge/wash moved outside cardContent's padding" file-header note for
  // why. top/left Spacing.md is now an unambiguous single inset on both platforms.
  badgeFixed: { position: 'absolute', top: Spacing.md, left: Spacing.md, zIndex: 2 },
  progressBar: { marginTop: Spacing.xs },
  paceText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },
  // includeFontPadding:false + textAlignVertical:'center' so the title optically centers against
  // the round CardAccentBadge on Android (same font-padding fix as TabSlider/ScreenHeader).
  title: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 1, includeFontPadding: false, textAlignVertical: 'center' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1 },
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
  // Quick-add target chip (2026-07-24) — cycles Weekly/Monthly-list, so it carries text
  // (unlike PlanTaskCard's icon-only quick-add chips) and needs a maxWidth to stay compact.
  targetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    maxWidth: 92,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  targetChipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, flexShrink: 1 },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  expandedBody: { gap: 0 },
  shoppingSection: { gap: Spacing.xs, marginTop: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.xs },
});
