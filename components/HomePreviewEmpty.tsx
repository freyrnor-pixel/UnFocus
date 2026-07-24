/**
 * HomePreviewEmpty.tsx — shared empty-state block for Home's preview cards.
 *
 * Renders one consistent empty state as a muted rounded box (debug-note 2026-07-22:
 * matches the `sectionEmpty` box used for empty sections on the Plans screen — see
 * app/(tabs)/plans.tsx — so an empty Notes/Plans/Shopping preview reads the same as
 * an empty section anywhere else in the app, not a bespoke bare text row). Centred
 * vertically within the card's collapsed resting height.
 *
 * Connections:
 *   Imports → constants/theme (FontSize, Fonts, Radius, Spacing), lib/useAppTheme
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard, components/PlanTaskCard
 *             (each card's empty branch)
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - `domainColor` is the {accent, soft} triad from lib/domainColor.getDomainColor,
 *     kept in the prop signature for callers but currently unused now that the box
 *     is domain-neutral (matches plans.tsx's sectionEmpty, which is also neutral).
 *   - Purely visual: keep it free of store/i18n access — callers pass the already
 *     localised `text` (e.g. t.notes.emptyState).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** Already-localised empty message. */
  text: string;
  /** Domain hue pair from getDomainColor(theme, domain). */
  domainColor: { accent: string; soft: string };
};

export default function HomePreviewEmpty({ text }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.box, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        {text}
      </Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // flex:1 lets the box centre vertically within the card's resting-height floor.
  wrap: { flex: 1, justifyContent: 'center', paddingVertical: Spacing.md },
  // Matches app/(tabs)/plans.tsx's `sectionEmpty` box exactly, plus includeFontPadding:false +
  // textAlignVertical:'center' so the message sits truly vertically centered within the box's
  // padded height on Android (the same font-padding fix as the card headers / TabSlider).
  box: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
