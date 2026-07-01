/**
 * Badge.tsx — small status pills, selectable chips, and initial avatars.
 *
 * Exports three related primitives that share the same rounded-pill shape:
 * `Badge` (status, non-interactive), `Chip` (toggleable filter pill), and
 * `Avatar` (initials circle, e.g. shared-household members).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/PressableScale
 *   Used by → any screen wanting status pills, filter chips, or initials avatars
 *   Data    → none (purely presentational)
 *
 * Edit notes:
 *   - Badge variants map to Decision 006 tokens only (no new hexes introduced).
 */
import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
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
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
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
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      style={[
        styles.pill,
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.surfaceMuted,
          borderColor: selected ? theme.accent : theme.border,
        },
        style,
      ]}
    >
      <Text style={[styles.pillText, { color: selected ? theme.accentInk : theme.text }]}>{label}</Text>
    </PressableScale>
  );
}

type AvatarProps = {
  name: string;
  size?: number;
  color?: string;
};

export function Avatar({ name, size = 36, color }: AvatarProps) {
  const theme = useAppTheme();
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? theme.accent },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4, color: theme.accentInk }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
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
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.bold,
  },
});
