/**
 * PadFooterToggle.tsx — the one expandability affordance on a pad card.
 *
 * Cycles the card's sizes (lib/padState): preview → open → preview. It was THREE sizes until
 * 2026-08-21, when `'closed'` left that axis — open/closed is components/Card.tsx's header
 * chevron now, for every card in the app. This control survives the unification because it can
 * say something a header chevron cannot: *"3 more"*. Replaces
 * four separately-worded accent text links ("Show all notes" / "Show full list" / "Show all
 * habits" / "Show less"), which carried no affordance at all beyond being coloured
 * (2026-07-30, user report: "expandability still seems to be non-existent").
 *
 * A chevron plus a count, so the control says both what it does and how much is behind it —
 * "3 more" reads as a promise, "Show all notes" reads as a label.
 *
 * Connections:
 *   Imports → components/AnimatedChevron, components/PressableScale, constants/theme,
 *             lib/useAppTheme, lib/haptics (tap), lib/i18n, lib/padState (PadState,
 *             nextPadState, padHiddenCount)
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,PlanTaskCard}.tsx,
 *             app/plans.tsx
 *   Data    → none — presentational; the caller persists via settings.cardStates
 *
 * Edit notes:
 *   - **Bottom-right corner, not centered full-width (card-element standardization pass,
 *     2026-08-20)** — this used to stretch to the card's full width (the default cross-axis
 *     stretch of a column flex parent) with its own content centered inside that width. That
 *     put components/CardExpandButton.tsx and this control on OPPOSITE ends of a card (the
 *     full-screen button top-right, this toggle bottom-center), reading as two unrelated
 *     affordances rather than a matched pair. `alignSelf: 'flex-end'` shrink-wraps it to its
 *     own content and pins that to the trailing edge, mirroring the full-screen button's corner.
 *   - The chevron points down while there's more to reveal and up when everything is shown.
 *   - Renders nothing unless there are more rows than the preview draws (see the guard): with
 *     every row already on screen the two remaining states are the same rendering, and a
 *     control that promises a size change that isn't one is worse than no control.
 *   - **(2026-07-31, addendum A.4 rule 1) The label and chevron are `theme.accent`, the app's
 *     one action colour — NOT the card's identity hue.** They used to take an `accent` prop
 *     that every caller filled with `getDomainColor(...).accent`, i.e. an identity hue used as
 *     text and as an icon colour, which is the one thing those hues are not for. The prop is
 *     gone rather than ignored. This also stopped the control changing colour card to card for
 *     no reason — it does the same thing everywhere — and fixed two live contrast failures:
 *     the Shopping gold at 2.25:1 on white, and Notes, whose hue is now IDENTITY_NEUTRAL grey
 *     and made a live control read as disabled.
 *   - **The pad-state size change is now animated (2026-08-11, user report: "movement of
 *     buttons while expanding and closing, and its not smooth").** Pressing this button had NO
 *     transition at all before — the card's grid height, its `cardCollapsed` floor and the
 *     anytime-list slice all changed in the very next render with nothing animating the jump.
 *     `onPress` now wraps the state change in the same guarded `LayoutAnimation.configureNext`
 *     call the app already uses for reflow elsewhere (lib/useDragReorder.ts, habits.tsx,
 *     shopping.tsx) rather than inventing a bespoke animation for this one control.
 */
import React from 'react';
import { LayoutAnimation, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import AnimatedChevron from '@/components/AnimatedChevron';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, HitSlop, MIN_TAP_TARGET, PAD_PREVIEW_ROWS, Spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { PadState, nextPadState, padHiddenCount } from '@/lib/padState';

type Props = {
  state: PadState;
  onChange: (next: PadState) => void;
  /** Total rows in the list, hidden ones included — drives the count label. */
  total: number;
  style?: StyleProp<ViewStyle>;
};

export default function PadFooterToggle({ state, onChange, total, style }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();

  // Nothing to reveal, nothing to draw. `total === 0` was the old guard — an empty pad has
  // nothing to expand — and it is not enough now that this control no longer closes the card:
  // with every row already on screen the two remaining states render identically, so the button
  // would sit there promising a size change that isn't one. A card with more rows than the
  // preview shows keeps it, in both directions, so "3 more" always has its way back.
  if (total <= PAD_PREVIEW_ROWS) return null;

  const hidden = padHiddenCount(total, state);
  const label =
    state === 'open' ? t.pad.less : hidden > 0 ? t.pad.more(hidden) : t.pad.all;

  return (
    <PressableScale
      style={[styles.footer, style]}
      hitSlop={HitSlop.base}
      onPress={() => {
        tap();
        // The card's own size change (grid height, the cardCollapsed floor, the anytime-list
        // slice) had NO animation at all before this — a hard cut, not just "not smooth"
        // (2026-08-11, user report on Home cards' expand/collapse). Same guarded
        // LayoutAnimation call this app already uses for reflow elsewhere (lib/useDragReorder,
        // habits.tsx, shopping.tsx) rather than a bespoke animation for this one control.
        if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onChange(nextPadState(state));
      }}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.inner}>
        <Text style={[styles.label, { color: theme.accent }]}>{label}</Text>
        <AnimatedChevron open={state === 'open'} size={14} color={theme.accent} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // ⚠️ **`minHeight` + `hitSlop`, or this is the app's one real tap-target violation**
  // (2026-08-21, CONSISTENCY_AUDIT.md §14). It had neither, so the control came out ≈28px tall
  // with nothing compensating — and it is the size control on all four pad cards, i.e. the
  // most-pressed thing on the Me tab. Every other under-48 control in the app pays for its
  // size one of these two ways; this one just didn't.
  //   The VISUAL row is deliberately still short (it is a label and a chevron tucked into a
  // card's bottom-right corner, not a key), which is exactly the case constants/theme.ts's
  // MIN_TAP_TARGET note describes: don't grow the art, expand the touch area.
  footer: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP_TARGET,
    paddingTop: Spacing.sm,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
});
