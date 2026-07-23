/**
 * ShoppingRow.tsx — single row in the weekly shopping list: two-line layout,
 * trailing × to remove, drag-reorder via the parent wrapping this row in
 * DraggableTaskRow.
 *
 * Decision 011 A2-2 redesign — NOT a faithful clone of the old row. Line 1:
 * leading check · name · price-total (right-aligned). Line 2 (smaller/dimmed):
 * qty+unit · qty stepper (−/badge/+) · in-stock label. The old inline
 * move-chevrons are retired (Ripple R1). **UX audit A1 (2026-07-23,
 * SCREEN_FUNCTIONS_AUDIT.md finding A1):** swipe-left-to-remove was dropped —
 * it was the only place in the app using swipe for delete (everywhere else
 * uses a trailing icon), so a user who learned it here found it didn't work
 * on Monthly/Catalogue/Plans/Notes/Health/Shared. Removal is now the same
 * trailing × button every other row in the app uses.
 *
 * Connections:
 *   Imports → components/Badge, components/FlightOverlay (FlightRect type only), components/InventoryIcon,
 *             components/PressableScale, constants/theme, constants/motion (Duration/Ease tokens),
 *             lib/date, lib/haptics, lib/i18n, lib/useAppTheme, react-native-reanimated,
 *             store/useShoppingStore (ShoppingItem type + recentlyAddedIds, see Decision 044b note)
 *   Used by → components/WeekListCard.tsx, app/(tabs)/shopping.tsx (weekly rows +
 *             purchased-history rows), components/HomeShoppingCard.tsx (Home shopping
 *             preview — planned + cart rows, no drag reorder)
 *   Data    → mutations still bubble up via onToggle/onCollect/onRemove/onIncrement/onDecrement
 *             callbacks (the parent screen calls toggleCheck/toggleCollected/adjustAmount/
 *             putBackToInventory/removeWithSource) — but this is no longer a fully "dumb"
 *             row: it reads `useShoppingStore(s => s.recentlyAddedIds[item.id])` directly
 *             (Decision 044b) to drive its own entrance/highlight animation, since that's
 *             ephemeral UI state the store already owns for free (see that store's header).
 *
 * Edit notes:
 *   - `variant` drives the leading button: 'planned' shows an outlined "+" when unchecked
 *     (calls onToggle — flips item.checked, moves the item to "In cart"); once checked, renders
 *     filled green with strikethrough + dim. 'cart' shows a filled green checkmark (always —
 *     items are checked by definition); tapping calls onToggle to uncheck and move the item back
 *     to "In list". A trailing × delete button (close-outline icon) appears on planned/cart rows
 *     for direct removal. The old separate "undo" arrow and "collected" state are removed;
 *     onCollect is kept as an optional prop for backward compat but is no longer called.
 *     'purchased' shows a static checkmark (read-only).
 *   - **R1 (drag reorder):** this component does NOT wrap itself in DraggableTaskRow — the
 *     parent (Session A2·2's screen) does that, passing this row as DraggableTaskRow's
 *     `children`. ShoppingRow has no drag-related props; it only needs to render cleanly
 *     as a plain child. The old inline move-up/move-down chevrons are gone entirely, not
 *     kept as a fallback.
 *   - **Trailing remove button (A1, replaces the old swipe gesture):** a single trailing
 *     `deleteBtn` (hidden on 'purchased' rows, disabled when `locked`) calls `heavy()` then
 *     `onRemove()` directly — no gesture, no reveal animation. It shows `InventoryIcon` (not
 *     "×") for `item.fromCatalog` rows on 'planned'/'cart' variants — those rows originated in
 *     the standing Katalog, so the parent's `onRemove` should put them back to
 *     status='catalog' instead of deleting them. 'purchased' rows and non-catalog (ad-hoc)
 *     rows keep the plain "×" look — this component doesn't decide which store action runs,
 *     only which icon to show. Icon color choice (fromCatalog uses `bad`, not a "positive"
 *     token, even though putting back to inventory isn't strictly destructive) is preserved
 *     from the old swipe-reveal's convention.
 *   - `dimmed` (`CHECKED_OPACITY`) applies to 'purchased' rows and to 'cart' rows once
 *     collected — NOT to every cart row, since "moved to cart" alone should stay fully
 *     opaque. Same constant reused by the "Shopping done" disabled state on the shopping
 *     screen — import `CHECKED_OPACITY` from here (R3) rather than a new literal.
 *   - The inline qty stepper (−/badge/+) renders on 'planned' and 'cart' rows whenever the
 *     parent passes onIncrement/onDecrement (omit both to hide it). **Decision 028:** the
 *     stepper does NOT read `locked` — adjusting a quantity of an item already on the list is
 *     neither an add nor a remove (the − floors at 1, so it can never delete a row), so it
 *     stays live regardless of lock state, same category as the checkbox. `locked` gates only
 *     the remove affordance (the swipe gesture, below). Bounds are 1–99: the − button disables at qty 1, the + button
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
 *   - **Re-add highlight (Decision 021, Phase 6 presentational half):** a self-decaying
 *     `goodSoft` glow flashes over the row whenever `item.amount` increases vs. its previous
 *     render. This is the transient "just added / amount increased" cue for the store's
 *     increment-on-re-add behavior — purely local component state (a `useRef` prev-amount +
 *     a `useSharedValue` opacity), NO persisted flag, no schema, no store action, no new prop.
 *     Fires for any amount increase the row observes (re-add or the inline stepper's +), which
 *     is the only local signal available; mount is skipped (ref seeded to the initial amount).
 *     Respects reducedMotion (fades without the leading pop). Visual-only — no i18n string, so
 *     it invents none (Decision 021 keeps the three states presentational, not stored data).
 *   - **New-row entrance + motion (Decision 044b):** `isNew` reads the store's
 *     `recentlyAddedIds` map (set by `add()`/`addToWeeklyFromCatalog()`, self-clears after
 *     ~1.8s). A row that mounts already flagged `isNew` (captured once via `wasNewOnMount`,
 *     a plain ref — re-renders after mount never retrigger it) plays the same Decision 021
 *     highlight glow immediately instead of skipping it, and the whole row plays
 *     `FadeInDown` on mount. Every row (new or not) now also carries `exiting={FadeOut}` and
 *     `layout={LinearTransition}` so removals fade instead of popping and sibling rows
 *     resettle smoothly when the list above them changes height — this is what makes
 *     list→cart moves (a different section = unmount+remount, not a true shared-element
 *     transition) read as "travel" rather than a teleport. All three respect reducedMotion.
 *     **2026-07-15**: durations moved off hardcoded magic numbers onto `Duration.listIn/
 *     cardOut/listMove` (same values, now the shared token) and each animation calls
 *     `.easing(Ease.enter/exit/move)` explicitly, matching Collapsible.tsx's house pattern
 *     (fixed alongside the same gap in PlanTaskCard.tsx and AnimatedListItem.tsx).
 *   - **Touch target (2026-07-11)**: the check circle is visually 22x22 but `hitSlop={13}`
 *     brings the tappable area to ~48dp, meeting Android's minimum touch-target size.
 *   - **Flight animation (Phase 1, 2026-07-11)**: `onFlightStart` (optional) fires with this
 *     row's window-space rect right before `onToggle`, letting the parent kick off a
 *     `FlightOverlay` clone (see ANIMATION_GUIDELINES.md). Only wired for the forward
 *     'planned'-and-unchecked → 'In cart' direction (`willFly`) — reverse toggles keep
 *     today's fade-only behavior, matching FLIGHT_ANIMATION_HANDOFF.md's stated Phase 1
 *     scope. The ref for measuring lives on the outer `styles.wrap` Animated.View.
 *   - **Category tag removed (2026-07-22)**: line 2 used to show a small bordered
 *     `categoryLabel(t, item.category)` tag — a pure display "marking" with no functional
 *     tie to anything. Now that `components/ShoppingFilterBar.tsx` gives Weekly/Monthly a
 *     real category filter, category's only job in this app is sorting/filtering — a
 *     decorative per-row tag contradicted that, so it's gone. Filter by category via the
 *     filter bar (WeekListCard.tsx) instead of reading it off each row.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { ShoppingItem, useShoppingStore } from '@/store/useShoppingStore';
import type { FlightRect } from '@/components/FlightOverlay';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { formatKr } from '@/lib/money';
import { heavy } from '@/lib/haptics';
import InventoryIcon from '@/components/InventoryIcon';
import { Badge } from '@/components/Badge';
import PressableScale from '@/components/PressableScale';

type Variant = 'planned' | 'cart' | 'purchased';

/** Stepper bounds — mirrors useShoppingStore.adjustAmount's own floor (it clamps at 0 and
 * deletes), but the stepper UI's own minimum is 1 so decrementing never silently removes a row. */
const MIN_QTY = 1;
const MAX_QTY = 99;

/** Shared "marked as done" dim amount — reuse this anywhere an item/button needs the same
 * reduced-opacity treatment (e.g. the disabled "Shopping done" button on the shopping screen). */
export const CHECKED_OPACITY = 0.55;

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
  /** See "Flight animation" edit note above. Omit to keep today's fade-only toggle. */
  onFlightStart?: (rect: FlightRect) => void;
};

function ShoppingRow({
  item,
  variant = 'planned',
  onToggle,
  onCollect,
  onRemove,
  onIncrement,
  onDecrement,
  inStockLabel,
  locked,
  onFlightStart,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const rowRef = useRef<any>(null);

  const qty = parseInt(item.amount, 10);
  const isNumeric = !isNaN(qty) && qty > 0;
  const safeQty = isNumeric ? qty : MIN_QTY;

  // Decision 044b: the store flags an id for ~1.8s right after add()/addToWeeklyFromCatalog()
  // creates or lands it — this is the "just added" signal the entrance animation + highlight
  // below key off, distinct from Decision 021's amount-increase glow (still handled below too).
  const isNew = useShoppingStore((s) => variant !== 'purchased' && !!s.recentlyAddedIds[item.id]);
  const wasNewOnMount = useRef(isNew).current;

  // Decision 021 (Phase 6) + Decision 044b: flash a self-decaying "just added / amount
  // increased" glow whenever the row's amount grows vs. its previous render (re-add increment,
  // stepper's +), OR the row mounts already flagged "just added" by the store (044b's new-row
  // case, which has no prior render to compare amounts against). Local shared-value animation
  // only — the store owns the underlying "is this new" fact, not this component.
  const highlight = useSharedValue(0);
  const prevQty = useRef(safeQty);
  useEffect(() => {
    if (wasNewOnMount) {
      if (reducedMotion) {
        highlight.value = 0.9;
        highlight.value = withTiming(0, { duration: 900 });
      } else {
        highlight.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 900 }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (safeQty > prevQty.current) {
      if (reducedMotion) {
        // No leading pop under reduced motion — start visible and fade out.
        highlight.value = 0.9;
        highlight.value = withTiming(0, { duration: 900 });
      } else {
        highlight.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 900 }));
      }
    }
    prevQty.current = safeQty;
  }, [safeQty]);
  const dimmed = variant === 'purchased' || (variant === 'planned' && item.checked);
  const showStepper = variant !== 'purchased' && !!(onIncrement || onDecrement);
  // Cart items allow decrement at qty=1 — the parent's onDecrement will handle the
  // move-back-to-list logic for the 1→0 case (qty never actually stores as 0; the
  // handler unchecks the item instead).
  const canDecrement = !!onDecrement && (variant === 'cart' ? safeQty >= MIN_QTY : safeQty > MIN_QTY);
  const canIncrement = !!onIncrement && safeQty < MAX_QTY;
  const priceTotal = item.price > 0 && isNumeric ? item.price * qty : null;
  const isPutBack = item.fromCatalog && variant !== 'purchased';

  function handleRemovePress() {
    heavy();
    onRemove();
  }

  // Phase 1 flight scope: only the forward "In list" (unchecked, planned) → "In cart"
  // toggle flies; reverse toggles keep today's fade-only unmount/remount.
  const willFly = !reducedMotion && !!onFlightStart && variant === 'planned' && !item.checked;

  function handleCheckPress() {
    if (willFly && rowRef.current?.measureInWindow) {
      rowRef.current.measureInWindow((x: number, y: number, width2: number, height: number) => {
        onFlightStart!({ x, y, width: width2, height });
        onToggle();
      });
    } else {
      onToggle();
    }
  }

  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlight.value }));

  return (
    <Animated.View
      ref={rowRef}
      style={styles.wrap}
      entering={!reducedMotion && wasNewOnMount ? FadeInDown.duration(Duration.listIn).easing(Ease.enter) : undefined}
      exiting={willFly ? undefined : (reducedMotion ? undefined : FadeOut.duration(Duration.cardOut).easing(Ease.exit))}
      layout={reducedMotion ? undefined : LinearTransition.duration(Duration.listMove).easing(Ease.move)}
    >
      <Animated.View style={[styles.row, dimmed && styles.rowChecked, { backgroundColor: theme.surface }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.highlight, { backgroundColor: theme.goodSoft, borderColor: theme.good }, highlightStyle]}
        />
        <PressableScale
          style={[
            styles.check,
            variant === 'planned' && (item.checked
              ? { backgroundColor: theme.good, borderColor: theme.good }
              : { borderColor: theme.good }),
            variant === 'cart' && { backgroundColor: theme.good, borderColor: theme.good },
            variant === 'purchased' && { backgroundColor: theme.good, borderColor: theme.good },
          ]}
          onPress={handleCheckPress}
          disabled={variant === 'purchased'}
          hitSlop={13}
          scaleTo={0.97}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!item.checked }}
          accessibilityLabel={item.name}
        >
          {variant === 'planned' && (item.checked
            ? <Ionicons name="checkmark" size={14} color={theme.textInverse} />
            : <Ionicons name="add" size={16} color={theme.good} />)}
          {variant === 'cart' && <Ionicons name="checkmark" size={14} color={theme.textInverse} />}
          {variant === 'purchased' && <Ionicons name="checkmark" size={14} color={theme.textInverse} />}
        </PressableScale>

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
                {formatKr(priceTotal, 0)}
              </Text>
            )}
          </View>

          <View style={styles.line2}>
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {item.amount}{item.unit ? ` ${item.unit}` : ''}
            </Text>

            {showStepper && (
              <View style={styles.stepper}>
                <PressableScale
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
                  scaleTo={0.9}
                >
                  <Ionicons name="remove" size={12} color={canDecrement ? theme.accentInk : theme.border} />
                </PressableScale>
                <Badge label={String(safeQty)} style={styles.stepBadge} />
                <PressableScale
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
                  scaleTo={0.9}
                >
                  <Ionicons name="add" size={12} color={canIncrement ? theme.accentInk : theme.border} />
                </PressableScale>
              </View>
            )}

            {item.inventoryQty > 0 && inStockLabel ? (
              <Text style={[styles.meta, { color: theme.good }]}>{inStockLabel}: {item.inventoryQty}</Text>
            ) : null}
          </View>
        </View>

        {variant !== 'purchased' && (
          <PressableScale
            style={styles.deleteBtn}
            onPress={handleRemovePress}
            disabled={locked}
            hitSlop={8}
            accessibilityLabel={isPutBack ? t.putBackItemLabel : t.removeItemLabel}
            scaleTo={0.93}
          >
            {isPutBack
              ? <InventoryIcon size={18} color={locked ? theme.textMuted : theme.bad} />
              : <Ionicons name="close-outline" size={18} color={locked ? theme.border : theme.textMuted} />}
          </PressableScale>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  rowChecked: { opacity: CHECKED_OPACITY },
  highlight: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  check: {
    width: 22,
    height: 22,
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
  deleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});

// React.memo with a custom comparator (perf sweep 2026-07-15): compare only the DATA props
// and ignore the callback props. Parents (WeekListCard, HomeShoppingCard, shopping.tsx) pass
// per-item inline closures like `() => onToggleItem(item)` that are recreated every render —
// a default shallow compare would never bail. This is safe because each closure only ever
// dispatches for THIS row's item: as long as `item` (and the other data props) are unchanged,
// the previous render's closure is still correct, so we can keep it. `item` keeps its object
// reference across store updates that don't touch it (only the mutated row gets a new object),
// so toggling one item re-renders only that row instead of the whole list. `isNew`/highlight
// come from ShoppingRow's own useShoppingStore subscription, not props, so they still update.
function shoppingRowPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.item === next.item &&
    prev.variant === next.variant &&
    prev.locked === next.locked &&
    prev.inStockLabel === next.inStockLabel &&
    // Presence (not identity) of optional callbacks controls what renders (stepper, flight).
    !!prev.onCollect === !!next.onCollect &&
    !!prev.onIncrement === !!next.onIncrement &&
    !!prev.onDecrement === !!next.onDecrement &&
    !!prev.onFlightStart === !!next.onFlightStart
  );
}
export default React.memo(ShoppingRow, shoppingRowPropsEqual);
