/**
 * Badge.tsx — small status pills and selectable chips.
 *
 * Exports two related primitives that share the same rounded-pill shape:
 * `Badge` (status, non-interactive) and `Chip` (toggleable filter pill).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/PressableScale
 *   Used by → any screen wanting status pills or filter chips
 *   Data    → none (purely presentational)
 *
 * Edit notes:
 *   - Badge variants map to Decision 006 tokens only (no new hexes introduced).
 */
import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { FontSize, Fonts, Radius, Spacing, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
import PressableScale from '@/components/PressableScale';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const theme = useAppTheme();
  const bg =
    variant === 'success' ? theme.goodSoft :
    variant === 'warning' ? theme.warnSoft :
    variant === 'danger' ? theme.badSoft :
    theme.surfaceMuted;
  const fg =
    variant === 'success' ? theme.good :
    variant === 'warning' ? theme.warn :
    variant === 'danger' ? theme.bad :
    theme.textMuted;

  return (
    // Thin matching edge (2026-07-18 "border around icons and buttons"): a subtle rim in the pill's
    // own foreground hue so status pills read as the same bordered family as the cards/chips.
    <View style={[styles.pill, styles.pillBorder, { backgroundColor: bg, borderColor: rgba(fg, 0.3) }, style]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
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
  pillText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
  },
  chip: {
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
});
