/**
 * SectionDivider.tsx — hairline rule flanked divider with a tiny centered tree mark.
 *
 * Used between major sections on longer screens (Settings categories, Home
 * modules) so long scrolls get a quiet visual breather instead of a plain gap.
 *
 * Connections:
 *   Imports → components/TreeWatermark, constants/theme, lib/useAppTheme
 *   Used by → (not yet mounted — Phase 3a foundational port; screens wire this in later)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import TreeWatermark from '@/components/TreeWatermark';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

export default function SectionDivider() {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      <TreeWatermark size={22} opacity={0.14} absolute={false} style={styles.mark} />
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
