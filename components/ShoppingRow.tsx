/**
 * ShoppingRow.tsx — single row in the weekly shopping list: two-line layout,
 * trailing × to remove, drag-reorder via the parent wrapping this row in
 * DraggableTaskRow.
 *
 * Decision 011 A2-2 redesign — NOT a faithful clone of the old row. Restructured again by
 * the row rule (2026-07-28, design-system v6 `Checklist Redesign Options`): the leading
 * cluster is check · quantity+unit; line 1 is name · price-total (right-aligned, the row's
 * ONE right-hand value); line 2 carries only the in-stock note. Quantity moved up beside the
 * check because "quantity is an input, not a value" — an input in the row made the row reflow
 * as the number changed and cost the money column its clean right edge — and the inline
 * −/badge/+ stepper moved out entirely into components/ShoppingItemSheet.tsx, which a tap on
 * the row's name/price area opens. The old inline move-chevrons are retired (Ripple R1). **UX audit A1 (2026-07-23,
 * SCREEN_FUNCTIONS_AUDIT.md finding A1):** swipe-left-to-remove was dropped —
 * it was the only place in the app using swipe for delete (everywhere else
 * uses a trailing icon), so a user who learned it here found it didn't work
 * on Monthly/Catalogue/Plans/Notes/Health/Shared. Removal is now the same
 * trailing × button every other row in the app uses.
 *
 * Connections:
 *   Imports → components/FlightOverlay (FlightRect type only), components/InventoryIcon,
 *             components/NewSinceGlow (row + field "your last view was hiding this" marker),
 *             components/PressableScale, constants/theme, constants/motion (Duration/Ease tokens),
 *             lib/cardLayout (LayoutSpec — what this row is allowed to draw),
 *             lib/date, lib/haptics, lib/i18n, lib/useAppTheme, react-native-reanimated,
 *             store/useShoppingStore (ShoppingItem type + recentlyAddedIds, see Decision 044b note)
 *   Used by → components/WeekListCard.tsx, app/(tabs)/shopping.tsx (weekly rows +
 *             purchased-history rows), components/HomeShoppingCard.tsx (Home shopping
 *             preview — planned + cart rows, no drag reorder)
 *   Data    → mutations still bubble up via onToggle/onCollect/onRemove/onOpenDetail
 *             callbacks (the parent screen calls toggleCheck/toggleCollected/
 *             putBackToInventory/removeWithSource, or opens the detail sheet) — but this is no longer a fully "dumb"
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
 *   - **The inline qty stepper is gone (2026-07-28).** It lives in
 *     components/ShoppingItemSheet.tsx now, reached by `onOpenDetail`. Decision 028's rule
 *     survives the move: quantity is neither an add nor a remove, so the sheet does NOT read
 *     `locked` either — a locked list can still have its quantities adjusted, and `locked`
 *     gates only the remove affordance. Quantity now *reads* in the leading cluster
 *     (`showQty`, gated on `spec.showMeta`); hiding it never hides the ability to change it,
 *     since the sheet always carries the stepper.
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
 *   - **Touch targets (2026-07-11, corrected 2026-08-01)**: remove (×) and complete (○) sit
 *     side by side here — the exact pair DESIGN_RULES rule 17 names as costly to confuse. They
 *     used to be `Spacing.sm` apart carrying symmetric `HitSlop.base` + `HitSlop.check`, whose
 *     touch areas overlapped by 13px; RN hit-tests siblings in reverse order, so the check won
 *     and the right edge of the visible × added the item to the cart instead of removing it.
 *     Both now sit in a `trailingCluster` using `RowTrailing` (constants/theme.ts): asymmetric
 *     slops clipped on the shared side, and a gap sized to leave 8px belonging to neither.
 *     `bigTouch` (the In-the-store layout) widens the circle to 32 and only helps.
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
import { DONE_ROW_OPACITY, Fonts, FontSize, Radius, RowTrailing, Spacing, TabularNums } from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { formatKr } from '@/lib/money';
import { heavy } from '@/lib/haptics';
import InventoryIcon from '@/components/InventoryIcon';
import NewSinceGlow from '@/components/NewSinceGlow';
import { LAYOUT_SPECS, type LayoutSpec } from '@/lib/cardLayout';
import PressableScale from '@/components/PressableScale';

type Variant = 'planned' | 'cart' | 'purchased';

/** Fallback quantity for a non-numeric `amount` ("2-3", "a bunch") — the row still needs a
 * number for its increase-glow comparison. The stepper's own 1–99 bounds moved to
 * components/ShoppingItemSheet.tsx along with the stepper itself (row rule, 2026-07-28). */
const MIN_QTY = 1;

/**
 * `ROW_DIVIDER_INSET` is GONE as of 2026-07-30. It existed so a divider cleared the LEADING
 * check circle, keeping the column of checks unbroken. The check moved to the right margin in
 * the same pass (see the trailing cluster in the JSX below), so there is nothing on the left to
 * clear any more and a rule that crosses the whole line is what reads as ruled paper. Callers
 * draw a full-width hairline instead — or better, let components/PadSheet.tsx draw it.
 *
 * Shared "marked as done" dim amount. Re-exported from constants/theme's `DONE_ROW_OPACITY`,
 * which is where it lives now that notes, tasks, shopping items and completed habits all share
 * one finished-row treatment — this alias keeps the existing call sites compiling.
 */
export const CHECKED_OPACITY = DONE_ROW_OPACITY;

type Props = {
  item: ShoppingItem;
  variant?: Variant;
  onToggle: () => void;
  onCollect?: () => void;
  onRemove: () => void;
  /**
   * Open this item's detail sheet (components/ShoppingItemSheet.tsx) — where quantity, unit,
   * price and category are edited. Tapping the row's name/price area calls this. Omit it and
   * the row is simply not tappable, which is what the read-only 'purchased' history wants.
   *
   * The old inline −/+ quantity stepper lived on `onIncrement`/`onDecrement`; both were
   * removed with it (row rule, 2026-07-28). Adjusting quantity goes through the sheet now.
   */
  onOpenDetail?: () => void;
  inStockLabel?: string;
  locked?: boolean;
  /** See "Flight animation" edit note above. Omit to keep today's fade-only toggle. */
  onFlightStart?: (rect: FlightRect) => void;
  /**
   * Resolved card layout (lib/cardLayout.ts). Omit for the historical two-line row —
   * every caller that hasn't opted in keeps exactly what it rendered before.
   */
  spec?: LayoutSpec;
  /**
   * The previous view was hiding this row (lib/useNewSinceSeen.ts). Purely a display flag:
   * it changes nothing about the item's own behaviour.
   */
  isNewSince?: boolean;
  /**
   * Fields the previous view wasn't drawing. Shopping's layouts never collapse rows, so
   * this is the channel that matters here: coming from "Just the basics", the quantity and
   * price that just appeared are what the user needs pointing out, not the row itself.
   */
  newFields?: { meta: boolean; price: boolean; extras: boolean };
};

function ShoppingRow({
  item,
  variant = 'planned',
  onToggle,
  onCollect,
  onRemove,
  onOpenDetail,
  inStockLabel,
  locked,
  onFlightStart,
  spec = LAYOUT_SPECS.normal,
  isNewSince = false,
  newFields,
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
        highlight.value = withTiming(0, { duration: Duration.hold });
      } else {
        highlight.value = withSequence(withTiming(1, { duration: Duration.micro }), withTiming(0, { duration: Duration.hold }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (safeQty > prevQty.current) {
      if (reducedMotion) {
        // No leading pop under reduced motion — start visible and fade out.
        highlight.value = 0.9;
        highlight.value = withTiming(0, { duration: Duration.hold });
      } else {
        highlight.value = withSequence(withTiming(1, { duration: Duration.micro }), withTiming(0, { duration: Duration.hold }));
      }
    }
    prevQty.current = safeQty;
  }, [safeQty, highlight, reducedMotion]);
  const dimmed = variant === 'purchased' || (variant === 'planned' && item.checked);
  // Layout gates. `spec.showMeta` now covers the LEADING quantity (2026-07-28: quantity moved
  // out of the second line and up next to the check); `spec.showExtras` covers the in-stock
  // note, which is all the second line still carries. Hiding quantity never removes the
  // ability to change it — the detail sheet always has it — so "Just the basics" is still a
  // display choice, not a capability cut.
  const showQty = spec.showMeta && item.amount.trim() !== '';
  const showInStock = spec.showExtras && item.inventoryQty > 0 && !!inStockLabel;
  const showSecondLine = showInStock;
  const priceTotal = spec.showPrice && item.price > 0 && isNumeric ? item.price * qty : null;
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
      <NewSinceGlow active={isNewSince} suppressed={wasNewOnMount}>
      <Animated.View style={[styles.row, spec.bigTouch && styles.rowBig, dimmed && styles.rowChecked, { backgroundColor: theme.surface }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.highlight, { backgroundColor: theme.goodSoft, borderColor: theme.good }, highlightStyle]}
        />
        {/* Quantity — READ here, EDITED in the detail sheet. It sits in the leading cluster
            next to the check (row rule, 2026-07-28) so the right column belongs to money
            alone and the row can't reflow while a number is being changed. */}
        {showQty && (
          <NewSinceGlow active={!!newFields?.meta} tight>
            <Text style={[styles.qtyLead, spec.bigTouch && styles.qtyLeadBig, { color: dimmed ? theme.textMuted : theme.textMuted }]} numberOfLines={1}>
              {item.amount}{item.unit ? ` ${item.unit}` : ''}
            </Text>
          </NewSinceGlow>
        )}

        <PressableScale
          style={styles.lines}
          onPress={onOpenDetail}
          disabled={!onOpenDetail}
          scaleTo={0.99}
          accessibilityLabel={item.name}
        >
          <View style={styles.line1}>
            <Text
              style={[styles.name, spec.bigTouch && styles.nameBig, { color: theme.text }, dimmed && { color: theme.textMuted, textDecorationLine: 'line-through' }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {priceTotal !== null && (
              <NewSinceGlow active={!!newFields?.price} tight>
                <Text style={[styles.priceTotal, TabularNums, { color: dimmed ? theme.textMuted : theme.text }]}>
                  {formatKr(priceTotal, 0)}
                </Text>
              </NewSinceGlow>
            )}
          </View>

          {showSecondLine && (
          <View style={styles.line2}>
            {showInStock ? (
              <Text style={[styles.meta, { color: theme.good }]}>{inStockLabel}: {item.inventoryQty}</Text>
            ) : null}
          </View>
          )}
        </PressableScale>

        {/* Trailing cluster (2026-07-30): remove, then the CHECK in the right margin — where a
            paper checklist puts its ticks, and the app-wide row anatomy since this pass (see
            AGENTS.md's row rule and components/PadRow.tsx). Moving the check off the leading
            edge is also what let the notepad rules run the whole line instead of being inset
            past a check column, which is why ROW_DIVIDER_INSET is retired. */}
        <View style={styles.trailingCluster}>
          {variant !== 'purchased' && (
            <PressableScale
              style={styles.deleteBtn}
              onPress={handleRemovePress}
              disabled={locked}
              hitSlop={RowTrailing.actionSlop}
              accessibilityLabel={isPutBack ? t.putBackItemLabel : t.removeItemLabel}
              scaleTo={0.93}
            >
              {isPutBack
                ? <InventoryIcon size={18} color={locked ? theme.textMuted : theme.bad} />
                : <Ionicons name="close-outline" size={18} color={locked ? theme.border : theme.textMuted} />}
            </PressableScale>
          )}

          <PressableScale
            style={[
              styles.check,
              spec.bigTouch && styles.checkBig,
              variant === 'planned' && (item.checked
                ? { backgroundColor: theme.good, borderColor: theme.good }
                : { borderColor: theme.good }),
              variant === 'cart' && { backgroundColor: theme.good, borderColor: theme.good },
              variant === 'purchased' && { backgroundColor: theme.good, borderColor: theme.good },
            ]}
            onPress={handleCheckPress}
            disabled={variant === 'purchased'}
            hitSlop={RowTrailing.checkSlop}
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
        </View>
      </Animated.View>
      </NewSinceGlow>
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
  // "In the store": read at arm's length, tapped one-handed while pushing a trolley.
  // Taller rows and a bigger check circle; the name grows via `nameBig`.
  rowBig: { paddingVertical: Spacing.md, gap: Spacing.md },
  checkBig: { width: 32, height: 32, borderRadius: Radius.full },
  nameBig: { fontSize: FontSize.lg },
  highlight: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  check: {
    width: RowTrailing.checkSize,
    height: RowTrailing.checkSize,
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
  // Leading quantity. `minWidth` (not a fixed width) so "1" and "250 g" both sit in a column
  // the names line up after, while a long unit can still take the room it needs; `textAlign`
  // right so the digits themselves align even when the unit varies.
  qtyLead: { minWidth: 34, maxWidth: 76, textAlign: 'right', fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  qtyLeadBig: { minWidth: 42, maxWidth: 92, fontSize: FontSize.sm },
  deleteBtn: {
    width: RowTrailing.actionSize,
    height: RowTrailing.actionSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Remove and complete are the pair rule 17 warns about by name, so they get their own gap
  // rather than the row's 8px — see RowTrailing in constants/theme.ts for the arithmetic.
  trailingCluster: { flexDirection: 'row', alignItems: 'center', gap: RowTrailing.gap },
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
    // Layout + glow MUST be compared here. They decide what the row draws, so leaving them
    // out would let a user switch layout in Settings and see nothing change until some
    // unrelated store write happened to invalidate each row. `spec` is compared by
    // reference, which is sound because specs are module-level singletons in
    // lib/cardLayout.ts (LAYOUT_SPECS) — never rebuilt per render.
    prev.spec === next.spec &&
    prev.isNewSince === next.isNewSince &&
    prev.newFields === next.newFields &&
    // Presence (not identity) of optional callbacks controls what renders (tap-through,
    // flight). Miss one here and the row won't repaint when a parent starts or stops
    // passing it — which is exactly how a layout change can fail to take effect.
    !!prev.onCollect === !!next.onCollect &&
    !!prev.onOpenDetail === !!next.onOpenDetail &&
    !!prev.onFlightStart === !!next.onFlightStart
  );
}
export default React.memo(ShoppingRow, shoppingRowPropsEqual);
