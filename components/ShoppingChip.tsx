/**
 * ShoppingChip.tsx — one shopping item as a tap-to-tick chip (2026-08-20).
 *
 * The chip shape of `components/ShoppingRow.tsx`, used only where `spec.chips` is set — today
 * that is the "In the store" layout alone (lib/cardLayout.ts). Tapping the chip toggles
 * `checked`, which is what moves the item between the list and the "recently used" drawer
 * under it; there is no second control, because one tap is the whole point of the surface.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme (getMatte + the tap-target and
 *             spacing tokens), lib/cardLayout (LayoutSpec — what this chip may draw),
 *             lib/haptics, lib/useAppTheme, store/useShoppingStore (ShoppingItem type only)
 *   Used by → components/WeekListCard.tsx (the "In list" and "Brukt nylig" sections, chip
 *             layout only — every other layout keeps ShoppingRow)
 *   Data    → none. Presentation only; the caller owns the store write.
 *
 * Edit notes:
 *   - **It is a MEMBERSHIP control, not a boolean, which is why it is a chip and not a
 *     Switch.** DESIGN_RULES.md rule 19a ("a boolean is always a slider") exempts a list
 *     row's own completion check and multi-select chip rows for exactly this case. Do not
 *     "fix" it into a toggle.
 *   - **Borderless matte, never a bordered pill.** The 2026-08-18 blueprint pass forbids
 *     borders and separate background boxes inside a card (*"Suggestion chips should be
 *     simple, borderless, matte shapes"*), so the resting fill is the shared `getMatte()`
 *     plate and the ticked state is carried by INK and a glyph, not by an outline. That is
 *     also why the ticked chip keeps the same plate rather than filling with `good`: a wall
 *     of saturated green chips is the "reads as a score" problem, and this surface is a set
 *     of errands, not a tally.
 *   - **It deliberately drops price and drag-reorder**, and that is a capability cut, not an
 *     oversight. Both are planning affordances and this layout is the one you hold in a shop;
 *     the ⋯/detail sheet, the price and the dragged order are all still there the moment you
 *     switch layout, because a layout may only ever SUBTRACT (lib/cardLayout.ts). Quantity
 *     survives as a superscript because a chip that doesn't say "×3" sends you home with one.
 *   - **The whole chip is the tap target**, sized past `MIN_TAP_TARGET` by its own padding
 *     rather than by a `hitSlop` — overlapping slop in a wrapping grid would make neighbouring
 *     chips fight for the same pixels, which is the one place slop actively hurts.
 *   - No entrance animation and no "just added" highlight, unlike ShoppingRow: in a grid the
 *     chips reflow around an insertion, so a glow on one of them reads as the grid twitching.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import {
  FontSize,
  Fonts,
  MIN_TAP_TARGET,
  Radius,
  Spacing,
  TabularNums,
  getMatte,
} from '@/constants/theme';
import { LAYOUT_SPECS, LayoutSpec } from '@/lib/cardLayout';
import { selection } from '@/lib/haptics';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import type { ShoppingItem } from '@/store/useShoppingStore';

/** How far the ticked chip's ink drops. Matches ShoppingRow's CHECKED_OPACITY in intent. */
const TICKED_OPACITY = 0.55;

type Props = {
  item: ShoppingItem;
  /** Ticked chips live in the "recently used" drawer and read as spent. */
  ticked: boolean;
  onToggle: () => void;
  /** Planning mode only — opens components/ShoppingItemSheet for quantity/price/category. */
  onOpenDetail?: () => void;
  /** Shopping (locked) mode blocks the detail route, same as the row's. */
  locked?: boolean;
  spec?: LayoutSpec;
};

export default function ShoppingChip({
  item,
  ticked,
  onToggle,
  onOpenDetail,
  locked,
  spec = LAYOUT_SPECS.inStore,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const styles = useScaledStyles(baseStyles);

  const qty = parseInt(item.amount, 10);
  // Only a real multiple earns the superscript — "×1" is noise on every chip in the grid.
  const showQty = !isNaN(qty) && qty > 1;

  function handlePress() {
    selection();
    onToggle();
  }

  // A long-press reaches the editor rather than a second visible control: the chip has one
  // tap and it is spent. It is deliberately absent while locked — there is nothing to edit
  // about a list you are standing in a shop with.
  const canEditDetail = !locked && !!onOpenDetail;

  return (
    <PressableScale
      style={[styles.chip, { backgroundColor: getMatte(isDark) }, spec.bigTouch && styles.chipBig]}
      onPress={handlePress}
      onLongPress={canEditDetail ? onOpenDetail : undefined}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ticked }}
      // BOTH, deliberately. `accessibilityState` is what native maps; react-native-web does
      // NOT map it here — measured, `aria-checked` came back null in both states — so on web
      // the chip announced as a checkbox with no state at all. `aria-checked` is the prop RNW
      // reads directly. Same shape as the `Fonts.italic` lesson: a gap no local harness can
      // see on the platform it actually breaks, so pin it on both paths rather than trusting
      // one to cover the other.
      aria-checked={ticked}
      accessibilityLabel={showQty ? `${item.name} ×${qty}` : item.name}
    >
      {ticked && (
        <Ionicons name="checkmark" size={14} color={theme.good} style={styles.tick} />
      )}
      <Text
        numberOfLines={1}
        style={[
          styles.name,
          spec.bigTouch && styles.nameBig,
          { color: theme.text },
          ticked && { opacity: TICKED_OPACITY, textDecorationLine: 'line-through' },
        ]}
      >
        {item.name}
      </Text>
      {showQty && (
        <View style={styles.qtyWrap}>
          <Text style={[styles.qty, { color: theme.textMuted }]}>{`×${qty}`}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const baseStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  // "In the store" asks for one-handed targets, so the chip grows with it rather than
  // carrying its own second size token.
  chipBig: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  tick: { marginRight: -2 },
  name: { fontSize: FontSize.md, fontFamily: Fonts.semibold, flexShrink: 1 },
  nameBig: { fontSize: FontSize.lg },
  qtyWrap: { justifyContent: 'flex-start' },
  qty: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, ...TabularNums },
});
