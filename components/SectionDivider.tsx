/**
 * SectionDivider.tsx — hairline rule flanked divider with a tiny centered tree mark.
 *
 * Used between major sections on longer screens (Settings categories, Home
 * modules) so long scrolls get a quiet visual breather instead of a plain gap.
 *
 * Connections:
 *   Imports → components/TreeWatermark, constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/shopping.tsx (between UKE 1-4 week sections on the Weekly tab),
 *             app/settings.tsx (between the accessibility group and the Data section —
 *             passes `style` to zero out its own marginVertical, see the `style` note below)
 *
 * Edit notes:
 *   - `style` (optional) overrides the row's own marginVertical — default unchanged for
 *     every other caller. Settings' content container already applies its own `gap` between
 *     siblings, so the divider's default marginVertical stacked ON TOP of that gap, reading
 *     as an oversized blank band (2026-07-23 fix, see app/settings.tsx).
 *   - The tree mark sits at opacity 0.3 (was 0.14, 2026-07-27): at 0.14 it was invisible on
 *     Settings' surface, so the divider read as two disconnected hairlines with an
 *     unexplained gap between them rather than one rule with a mark in it. If it needs to go
 *     quieter again, close the gap instead — a mark you can't see is worse than no mark.
 */
import React from 'react';
import { StyleProp, View, ViewStyle, StyleSheet } from 'react-native';
import TreeWatermark from '@/components/TreeWatermark';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  style?: StyleProp<ViewStyle>;
};

export default function SectionDivider({ style }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      <TreeWatermark size={22} opacity={0.3} absolute={false} style={styles.mark} />
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  mark: {
    marginHorizontal: Spacing.sm,
  },
});
