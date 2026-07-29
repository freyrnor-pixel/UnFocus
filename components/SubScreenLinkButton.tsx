/**
 * SubScreenLinkButton.tsx — a single button-launched sub-screen link (badge + label,
 * pushed onto a Surface card), for screens that reach a related screen without giving
 * it a permanent Home card or in-place tab.
 *
 * Mirrors app/(tabs)/shopping.tsx's inline Food/Catalogue link row (UX audit F1,
 * 2026-07-23) — that pattern predates this component and stays as-is there; this is
 * the shared version for the two NEW callers (Habits, Plans/To-do) that needed the
 * same shape for their "Goals" entry point (2026-07-29, Goals dropped from Home — see
 * app/goals.tsx's header).
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, components/CardAccent
 *             (CardAccentBadge), constants/theme, lib/useAppTheme, lib/domainColor (Domain)
 *   Used by → app/(tabs)/habits.tsx, app/(tabs)/plans.tsx (both a "Goals" link)
 *   Data    → none (presentational; onPress is the caller's router.push)
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge } from '@/components/CardAccent';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { Domain } from '@/lib/domainColor';

type Props = {
  domain: Domain;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export default function SubScreenLinkButton({ domain, icon, label, onPress, accessibilityLabel }: Props) {
  const theme = useAppTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      scaleTo={0.97}
    >
      <Surface style={styles.card}>
        <CardAccentBadge domain={domain} icon={icon} size={24} />
        <Text style={[styles.text, { color: theme.text }]} numberOfLines={1}>{label}</Text>
      </Surface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  text: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
