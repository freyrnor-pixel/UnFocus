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
 *             lib/haptics (tap), lib/i18n, lib/padState (PadState, nextPadState,
 *             padHiddenCount), lib/useAppTheme
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/(tabs)/plans.tsx
 *   Data    → none — presentational; the caller persists via settings.cardStates
 *
 * Edit notes:
 *   - The chevron points down while there's more to reveal and up on the last step, so one
 *     glyph covers a three-state cycle without a second control or a hidden long-press.
 *   - Renders nothing when `total === 0`: an empty pad has nothing to expand, and a dead
 *     control on an empty card is exactly the kind of noise this pass is removing.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import AnimatedChevron from '@/components/AnimatedChevron';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { PadState, nextPadState, padHiddenCount } from '@/lib/padState';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  state: PadState;
  onChange: (next: PadState) => void;
  /** Total rows in the list, hidden ones included — drives the count label. */
  total: number;
  /** Domain accent (lib/domainColor) for the label and chevron. */
  accent: string;
  style?: StyleProp<ViewStyle>;
};

export default function PadFooterToggle({ state, onChange, total, accent, style }: Props) {
  const theme = useAppTheme();
  const t = useT();

  if (total === 0) return null;

  const hidden = padHiddenCount(total, state);
  const label =
    state === 'open' ? t.pad.less : hidden > 0 ? t.pad.more(hidden) : t.pad.all;

  return (
    <PressableScale
      style={[styles.footer, style]}
      onPress={() => {
        tap();
        onChange(nextPadState(state));
      }}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.inner}>
        <Text style={[styles.label, { color: accent }]}>{label}</Text>
        <AnimatedChevron open={state === 'open'} size={14} color={accent} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingTop: Spacing.sm },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
});
