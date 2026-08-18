/**
 * PadFooterToggle.tsx — the one expandability affordance on a pad card.
 *
 * Cycles the card's three sizes (lib/padState): closed → preview → open → closed. Replaces
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
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/plans.tsx
 *   Data    → none — presentational; the caller persists via settings.cardStates
 *
 * Edit notes:
 *   - The chevron points down while there's more to reveal and up on the last step, so one
 *     glyph covers a three-state cycle without a second control or a hidden long-press.
 *   - Renders nothing when `total === 0`: an empty pad has nothing to expand, and a dead
 *     control on an empty card is exactly the kind of noise this pass is removing.
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
import { FontSize, Fonts, Spacing } from '@/constants/theme';
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

  if (total === 0) return null;

  const hidden = padHiddenCount(total, state);
  const label =
    state === 'open' ? t.pad.less : hidden > 0 ? t.pad.more(hidden) : t.pad.all;

  return (
    <PressableScale
      style={[styles.footer, style]}
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
  footer: { alignItems: 'center', paddingTop: Spacing.sm },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
});
