/**
 * SectionRail.tsx — color-rail section header: a hue dot + label (+ optional count / right slot).
 *
 * The header half of the 2026-07-13 "color rail" list redesign (Tasks screen first, meant as
 * the reusable section primitive for the other list screens too). Pairs with a stack of cards
 * that each carry a matching `railColor` left edge — the shared hue is what binds a header to
 * its rows, replacing the old flat-color pill (`sectionHeader()` in plans.tsx). The `hue` is a
 * domain accent from lib/domainColor.getDomainColor(theme, domain).accent, which has both a
 * light and a dark variant, so the label/dot stay distinct and legible in both modes.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/plans.tsx, components/SharedTasksSection.tsx
 *             (adopt on Shopping/Health/Habits section headers for a consistent structure)
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - `hue` should be a solid domain accent (works on any surface, both modes); do NOT pass a
 *     translucent tint here — the label needs full contrast.
 *   - `count` is optional; omit it for sections where a tally adds noise (e.g. weekday groups).
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Solid domain accent (getDomainColor(theme, domain).accent). Colors the dot + label. */
  hue: string;
  label: string;
  /** Optional item tally shown after the label. */
  count?: number;
  /** Optional control rendered flush-right (e.g. a toggle). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SectionRail({ hue, label, count, right, style }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.dot, { backgroundColor: hue }]} />
      <Text style={[styles.label, { color: hue }]}>{label}</Text>
      {count != null && (
        <Text style={[styles.count, { color: theme.textMuted }]}>{count}</Text>
      )}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 2, marginBottom: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  count: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  right: { marginLeft: 'auto' },
});
