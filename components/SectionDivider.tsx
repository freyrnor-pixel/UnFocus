/**
 * SectionDivider.tsx — a forking branch drawn between major sections.
 *
 * Used between major sections on longer screens (Settings categories, Home
 * modules) so long scrolls get a quiet visual breather instead of a plain gap.
 *
 * Connections:
 *   Imports → components/Motif (the `trunk-divider` motif), constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/shopping.tsx (between UKE 1-4 week sections on the Weekly tab),
 *             app/settings.tsx (between the accessibility group and the Data section —
 *             passes `style` to zero out its own marginVertical, see the `style` note below)
 *
 * Edit notes:
 *   - `style` (optional) overrides the row's own marginVertical — default unchanged for
 *     every other caller. Settings' content container already applies its own `gap` between
 *     siblings, so the divider's default marginVertical stacked ON TOP of that gap, reading
 *     as an oversized blank band (2026-07-23 fix, see app/settings.tsx).
 *   - **This was two hairlines plus a tree mark, and the mark was invisible (2026-07-28).**
 *     The mark used assets/android-icon-monochrome.png — Android's *monochrome themed icon*,
 *     a near-white silhouette the OS is supposed to tint. Untinted on a light surface it
 *     vanished at any opacity (measured peak contrast delta 25, vs 360 for the hairlines), so
 *     the divider read as two disconnected rules with an unexplained gap. Tinting it to
 *     `theme.border` (2026-07-28) fixed the visibility but left it as three separate parts.
 *     Since 2026-07-31 it is ONE `trunk-divider` motif — a real forking branch that spans the
 *     whole width — so there is nothing to disconnect. TreeWatermark is no longer imported.
 *   - Colour is `theme.border`, deliberately the same weight the two hairlines had: this is a
 *     breather, not a feature. The motif's own per-element opacities do the rest.
 *   - `fit="meet"` keeps the whole branch visible. A backdrop would use the default 'slice',
 *     but an inline mark that gets its ends cropped just looks broken.
 */
import React from 'react';
import { StyleProp, View, ViewStyle, StyleSheet } from 'react-native';
import Motif from '@/components/Motif';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

/** The trunk-divider motif's own aspect (400×50), so the row reserves the right height. */
const DIVIDER_HEIGHT = 26;

type Props = {
  style?: StyleProp<ViewStyle>;
};

export default function SectionDivider({ style }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, style]} pointerEvents="none">
      <Motif id="trunk-divider" color={theme.border} fit="meet" style={styles.branch} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: Spacing.md,
    height: DIVIDER_HEIGHT,
  },
  branch: {
    flex: 1,
  },
});
