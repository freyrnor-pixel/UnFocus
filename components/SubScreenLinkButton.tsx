/**
 * SubScreenLinkButton.tsx — a single button-launched sub-screen link (badge + label,
 * pushed onto a Surface card), for screens that reach a related screen without giving
 * it a permanent Home card or in-place tab.
 *
 * Mirrors app/(tabs)/shopping.tsx's inline Food/Catalogue link row (UX audit F1,
 * 2026-07-23) — that pattern predates this component and stays as-is there; this is
 * the shared version for the two NEW callers (Habits, Plans/To-do) that needed the
 * same shape for their "Edit Goals" entry point (2026-07-29, Goals dropped from Home —
 * see app/goals.tsx's header; renamed + moved to the bottom of each screen + `onPress`
 * switched from a `router.push('/goals')` to opening components/GoalsSheet.tsx as a
 * popup, 2026-07-31).
 *
 * Connections:
 *   Imports → components/Surface (its `onPress` key path — no PressableScale wrapper), components/CardAccent
 *             (CardAccentBadge), constants/theme, lib/useAppTheme, lib/domainColor (Domain)
 *   Used by → app/(tabs)/habits.tsx, app/(tabs)/plans.tsx (both an "Edit Goals" link)
 *   Data    → none (presentational; `onPress` is the caller's — a router.push elsewhere,
 *             opening a popup for the Habits/Plans Goals link)
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
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
    <Surface
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <CardAccentBadge domain={domain} icon={icon} size={24} />
      <Text style={[styles.text, { color: theme.text }]} numberOfLines={1}>{label}</Text>
    </Surface>
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
