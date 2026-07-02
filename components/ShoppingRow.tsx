/**
 * ShoppingRow.tsx — single row in the weekly shopping list: two-line layout,
 * swipe-left to remove, drag-reorder via the parent wrapping this row in
 * DraggableTaskRow.
 *
 * Decision 011 A2-2 redesign — NOT a faithful clone of the old row. Line 1:
 * leading check · name · price-total (right-aligned). Line 2 (smaller/dimmed):
 * qty+unit · qty stepper (−/badge/+) · in-stock label. The old inline
 * move-chevrons are retired (Ripple R1) and remove is no longer a static
 * trailing button (Ripple R2) — both replaced by gesture surfaces.
 *
 * Connections:
 *   Imports → components/Badge, components/InventoryIcon, constants/theme, lib/haptics,
 *             lib/i18n, lib/useAppTheme, react-native-gesture-handler, react-native-reanimated,
 *             store/useShoppingStore (ShoppingItem type only)
 *   Used by → components/WeekListCard.tsx, app/shopping.tsx (weekly rows + purchased-history rows)
 *   Data    → none directly — all mutations are bubbled up via onToggle/onCollect/onRemove/
 *             onIncrement/onDecrement callbacks, same dumb-row pattern as NoteRow/MonthlyTableRow.
 *             The parent screen (Session A2·2) is what actually calls
 *             toggleCheck/toggleCollected/adjustAmount/putBackToInventory/removeWithSource.
 *
 * Edit notes:
 *   - `variant` drives the leading button: 'planned' shows a checkbox — unchecked is an
 *     outlined "+" (calls onToggle, which flips item.checked in the parent — no separate
 *     confirm step); once checked it renders filled/checked with the name struck through +
 *     dimmed, same look as the other "in cart" states below, and tapping again unchecks it.
 *     'cart' shows the "collected" checkbox (filled checkmark + strikethrough + dim when
 *     item.collected, calls onCollect) — moving a cart item back to planned is the separate
 *     trailing "undo" icon (calls onToggle), so collecting and un-cart-ing don't share a
 *     button. 'purchased' shows a static checkmark (read-only — purchased/history rows only
 *     leave via swipe-remove, never onToggle).
 *   - **R1 (drag reorder):** this component does NOT wrap itself in DraggableTaskRow — the
 *     parent (Session A2·2's screen) does that, passing this row as DraggableTaskRow's
 *     `children`. ShoppingRow has no drag-related props; it only needs to render cleanly
 *     as a plain child. The old inline move-up/move-down chevrons are gone entirely, not
 *     kept as a fallback.
 *   - **R2 (swipe-left remove):** implemented as a horizontal `Gesture.Pan`, disambiguated
 *     from vertical scrolling the same way `components/SiteSwipeView.tsx` disambiguates its
 *     horizontal nav swipe (`activeOffsetX([-12, 12])` + `failOffsetY([-10, 10])`) — that's
 *     the only other real horizontal-swipe precedent in this codebase, reused here rather
 *     than inventing new thresholds. A background reveal layer (colored per the catalog/
 *     ad-hoc branch) fades in as the row slides left; releasing past `COMMIT_THRESHOLD`
 *     (or a fast enough flick, `SWIPE_VELOCITY_THRESHOLD` — same 800 magnitude as
 *     SiteSwipeView) animates the row off-screen and calls `onRemove`; releasing short of
 *     that snaps back to 0. `selection()` fires once on crossing the commit threshold
 *     mid-drag, `heavy()` fires once the swipe actually commits — mirrors the existing
 *     tap/drag haptic-timing contract in ANIMATION_GUIDELINES.md §4 (fire at the moment of
 *     the visual event, not before/after). `locked` disables the gesture outright
 *     (`.enabled(!locked)`) rather than dimming a button, since remove is no longer a button.
 *   - The trailing remove reveal shows `InventoryIcon` (not "×") for `item.fromCatalog` rows
 *     on 'planned'/'cart' variants — those rows originated in the standing Katalog, so the
 *     parent's `onRemove` should put them back to status='catalog' instead of deleting them.
 *     'purchased' rows and non-catalog (ad-hoc) rows keep the plain "×" look — this component
 *     doesn't decide which store action runs, only which icon/reveal-tint to show. Preserved
 *     1:1 from the old row per Decision 011 R2 ("same store actions, new gesture surface"),
 *     including the old row's icon-color choice (fromCatalog reveal uses `bad`, not a
 *     "positive" token, even though putting back to inventory isn't strictly destructive).
 *   - `dimmed` (`CHECKED_OPACITY`) applies to 'purchased' rows and to 'cart' rows once
 *     collected — NOT to every cart row, since "moved to cart" alone should stay fully
 *     opaque. Same constant reused by the "Shopping done" disabled state on the shopping
 *     screen — import `CHECKED_OPACITY` from here (R3) rather than a new literal.
 *   - The inline qty stepper (−/badge/+) renders on 'planned' and 'cart' rows whenever the
 *     parent passes onIncrement/onDecrement (omit both to hide it) AND the row isn't
 *     `locked` — locked hides the stepper entirely rather than disabling it, matching the
 *     old row's behavior. Bounds are 1–99: the − button disables at qty 1, the + button
 *     disables at qty 99 (the store's adjustAmount clamps at 0 by deleting the row, but the
 *     stepper's own floor is 1 so "delete by stepper" never happens here — removal stays the
 *     swipe gesture's job). Hidden entirely on 'purchased' rows.
 *   - Price now lives only as the line-1 total (A2-2) — the old row's separate "kr/stk"
 *     unit-price meta text is dropped; A2-2's own rationale ("keeping money glanceable")
 *     is served by the total alone, and the redesign's spec doesn't mention a per-unit line.
 *   - The leading check circle is a hand-rolled circular Pressable, not `FormControls`'
 *     square-cornered Checkbox — same precedent `NoteRow.tsx`/`TaskItem.tsx` already
 *     established for this shared circular "done" affordance.
 *   - `theme.brown` (old stepper-enabled color) remapped to `accent`, matching the
 *     `theme.brown`→`accent` precedent already recorded in PROGRESS_LOG.md (Phase 3c).
 *   - `theme` is no longer threaded in as a prop — reads useAppTheme() internally,
 *     consistent with every other ported component.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { ShoppingItem } from '@/store/useShoppingStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { selection, heavy } from '@/lib/haptics';
import InventoryIcon from '@/components/InventoryIcon';
import { Badge } from '@/components/Badge';

type Variant = 'planned' | 'cart' | 'purchased';

/** Stepper bounds — mirrors useShoppingStore.adjustAmount's own floor (it clamps at 0 and
 * deletes), but the stepper UI's own minimum is 1 so decrementing never silently removes a row. */
const MIN_QTY = 1;
const MAX_QTY = 99;

/** Shared "marked as done" dim amount — reuse this anywhere an item/button needs the same
 * reduced-opacity treatment (e.g. the disabled "Shopping done" button on the shopping screen). */
export const CHECKED_OPACITY = 0.55;

/** Swipe-left-to-remove tuning — same disambiguation/threshold idiom as SiteSwipeView.tsx,
 * the only other horizontal-swipe precedent in this codebase. */
const MAX_SWIPE = -96;
const COMMIT_THRESHOLD = -64;
const SWIPE_VELOCITY_THRESHOLD = 800;

type Props = {
  item: ShoppingItem;
  variant?: Variant;
  onToggle: () => void;
  onCollect?: () => void;
  onRemove: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  inStockLabel?: string;
  locked?: boolean;
};

export default function ShoppingRow({
  item,
  variant = 'planned',
  onToggle,
  onCollect,
  onRemove,
  onIncrement,
  onDecrement,
  inStockLabel,
  locked,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const { width } = useWindowDimensions();

  const translateX = useSharedValue(0);
  const crossedThreshold = useSharedValue(false);

  const qty = parseInt(item.amount, 10);
  const isNumeric = !isNaN(qty) && qty > 0;
  const safeQty = isNumeric ? qty : MIN_QTY;
  const dimmed = variant === 'purchased' || (variant === 'cart' && item.collected) || (variant === 'planned' && item.checked);
  const showStepper = variant !== 'purchased' && !locked && !!(onIncrement || onDecrement);
  const canDecrement = !!onDecrement && safeQty > MIN_QTY;
  const canIncrement = !!onIncrement && safeQty < MAX_QTY;
  const priceTotal = item.price > 0 && isNumeric ? item.price * qty : null;
  const isPutBack = item.fromCatalog && variant !== 'purchased';

  function commitRemove() {
    onRemove();
  }

  const pan = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const next = Math.max(MAX_SWIPE, Math.min(0, e.translationX));
      translateX.value = next;
      if (next < COMMIT_THRESHOLD && !crossedThreshold.value) {
        crossedThreshold.value = true;
        runOnJS(selection)();
      } else if (next >= COMMIT_THRESHOLD && crossedThreshold.value) {
        crossedThreshold.value = false;
      }
    })
    .onEnd((e) => {
      const commit = translateX.value < COMMIT_THRESHOLD || e.velocityX < -SWIPE_VELOCITY_THRESHOLD;
      crossedThreshold.value = false;
      if (commit) {
        runOnJS(heavy)();
        if (reducedMotion) {
          runOnJS(commitRemove)();
        } else {
          translateX.value = withTiming(-width, { duration: 200 }, (finished) => {
            if (finished) runOnJS(commitRemove)();
          });
        }
      } else {
        translateX.value = reducedMotion ? 0 : withTiming(0, { duration: 150 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / Math.abs(COMMIT_THRESHOLD)),
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.reveal, { backgroundColor: isPutBack ? theme.badSoft : theme.surfaceMuted }, revealStyle]}
      >
        {isPutBack ? <InventoryIcon size={20} color={theme.bad} /> : <Ionicons name="close" size={22} color={theme.textMuted} />}
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, dimmed && styles.rowChecked, contentStyle, { backgroundColor: theme.surface }]}>
          <Pressable
            style={[
              styles.check,
              variant === 'planned' && (item.checked
                ? { backgroundColor: theme.good, borderColor: theme.good }
                : { borderColor: theme.good }),
              variant === 'cart' && (item.collected
                ? { backgroundColor: theme.good, borderColor: theme.good }
                : { borderColor: theme.accent }),
              variant === 'purchased' && { backgroundColor: theme.good, borderColor: theme.good },
            ]}
            onPress={variant === 'cart' ? onCollect : onToggle}
            disabled={variant === 'purchased'}
            hitSlop={6}
          >
            {variant === 'planned' && (item.checked
              ? <Ionicons name="checkmark" size={14} color={theme.textInverse} />
              : <Ionicons name="add" size={16} color={theme.good} />)}
            {variant === 'cart' && item.collected && <Ionicons name="checkmark" size={14} color={theme.textInverse} />}
            {variant === 'purchased' && <Ionicons name="checkmark" size={14} color={theme.textInverse} />}
          </Pressable>

          <View style={styles.lines}>
            <View style={styles.line1}>
              <Text
                style={[styles.name, { color: theme.text }, dimmed && { color: theme.textMuted, textDecorationLine: 'line-through' }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {priceTotal !== null && (
                <Text style={[styles.priceTotal, { color: dimmed ? theme.textMuted : theme.text }]}>
                  {priceTotal.toFixed(0)} kr
                </Text>
              )}
            </View>

            <View style={styles.line2}>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.amount}{item.unit ? ` ${item.unit}` : ''}
              </Text>

              {showStepper && (
                <View style={styles.stepper}>
                  <Pressable
                    style={[
                      styles.stepBtn,
                      canDecrement
                        ? { backgroundColor: theme.accent, borderColor: theme.accent }
                        : { backgroundColor: 'transparent', borderColor: theme.border },
                    ]}
                    onPress={onDecrement}
                    disabled={!canDecrement}
                    hitSlop={4}
                    accessibilityLabel={t.decreaseQty}
                  >
                    <Ionicons name="remove" size={12} color={canDecrement ? theme.accentInk : theme.border} />
                  </Pressable>
                  <Badge label={String(safeQty)} style={styles.stepBadge} />
                  <Pressable
                    style={[
                      styles.stepBtn,
                      canIncrement
                        ? { backgroundColor: theme.accent, borderColor: theme.accent }
                        : { backgroundColor: 'transparent', borderColor: theme.border },
                    ]}
                    onPress={onIncrement}
                    disabled={!canIncrement}
                    hitSlop={4}
                    accessibilityLabel={t.increaseQty}
                  >
                    <Ionicons name="add" size={12} color={canIncrement ? theme.accentInk : theme.border} />
                  </Pressable>
                </View>
              )}

              {item.inventoryQty > 0 && inStockLabel ? (
                <Text style={[styles.meta, { color: theme.good }]}>{inStockLabel}: {item.inventoryQty}</Text>
              ) : null}
            </View>
          </View>

          {variant === 'cart' && (
            <Pressable style={styles.undo} onPress={onToggle} hitSlop={8}>
              <Ionicons name="arrow-undo" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: { position: 'relative' },
  reveal: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.md,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  rowChecked: { opacity: CHECKED_OPACITY },
  check: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lines: { flex: 1, minWidth: 0 },
  line1: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  priceTotal: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  line2: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 2 },
  meta: { fontSize: FontSize.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: { minWidth: 22, alignItems: 'center' },
  undo: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
