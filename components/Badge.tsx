/**
 * Badge.tsx — small status pills and selectable chips.
 *
 * Exports two related primitives that share the same rounded-pill shape:
 * `Badge` (status, non-interactive) and `Chip` (toggleable filter pill).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/PressableScale
 *   Used by → any screen wanting status pills or filter chips; the Home cards'
 *             domain-hued count pill (DESIGN_COMPARISON/09, `bg`/`fg`/`borderColor` overrides —
 *             HomeNotesCard, HomeHabitsCard, HomeShoppingCard, PlanTaskCard)
 *   Data    → none (purely presentational)
 *
 * Edit notes:
 *   - Badge variants map to Decision 006 tokens BY DEFAULT. `bg`/`fg`/`borderColor` let a caller
 *     override the fill for a domain-hued pill without a second component — but `fg` must never
 *     be a `domainColor.accent` (lib/domainColor.ts's A.4 rule 1: an identity hue is a fill,
 *     never text/icon colour — Shopping's gold is 2.25:1 on its own soft wash and fails AA as
 *     ink). Pass `domainColor.soft` for `bg` and `theme.text`/`theme.textMuted` for `fg`.
 *   - `tabularNums` applies `constants/theme`'s `TabularNums` to the label — needed whenever the
 *     label is a count that must not shift width digit to digit (e.g. "1/8" vs "17/28").
 */
import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { FontSize, Fonts, OpticalCenter, Radius, Spacing, TabularNums, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
import PressableScale from '@/components/PressableScale';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  /** Override the variant-derived fill — e.g. `domainColor.soft` for a per-card identity hue. */
  bg?: string;
  /** Override the variant-derived ink. Never pass a `domainColor.accent` here — see edit notes. */
  fg?: string;
  /** Override the variant-derived rim colour. Defaults to a 30%-alpha rim of `fg`. */
  borderColor?: string;
  /** Fixed-width figures, for a label that's a count. */
  tabularNums?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, variant = 'neutral', bg, fg, borderColor, tabularNums, accessibilityLabel, style }: BadgeProps) {
  const theme = useAppTheme();
  const resolvedBg = bg ?? (
    variant === 'success' ? theme.goodSoft :
    variant === 'warning' ? theme.warnSoft :
    variant === 'danger' ? theme.badSoft :
    theme.surfaceMuted
  );
  const resolvedFg = fg ?? (
    variant === 'success' ? theme.good :
    variant === 'warning' ? theme.warn :
    variant === 'danger' ? theme.bad :
    theme.textMuted
  );
  const resolvedBorder = borderColor ?? rgba(resolvedFg, 0.3);

  return (
    // Thin matching edge (2026-07-18 "border around icons and buttons"): a subtle rim in the pill's
    // own foreground hue so status pills read as the same bordered family as the cards/chips.
    <View
      style={[styles.pill, styles.pillBorder, { backgroundColor: resolvedBg, borderColor: resolvedBorder }, style]}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.pillText, tabularNums && TabularNums, { color: resolvedFg }]}>{label}</Text>
    </View>
  );
}

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, selected, onPress, style }: ChipProps) {
  const theme = useAppTheme();
  // Background + border crossfade as the chip selects/deselects (text colour swaps on top).
  const animatedStyle = useToggleColor(!!selected, {
    backgroundColor: [theme.surfaceMuted, theme.accent],
    borderColor: [theme.border, theme.accent],
  });
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} style={style}>
      <Animated.View style={[styles.pill, styles.chip, animatedStyle]}>
        <Text style={[styles.pillText, { color: selected ? theme.accentInk : theme.text }]}>{label}</Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  pillBorder: {
    borderWidth: 1,
  },
  // OpticalCenter (2026-08-13): a pill is a short box a Text does not size, so on Android the
  // glyphs rode high inside it — most visible on the example rows' time pill, which pins its
  // height. Every pill in the app draws through here.
  pillText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    ...OpticalCenter,
  },
  chip: {
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
});
