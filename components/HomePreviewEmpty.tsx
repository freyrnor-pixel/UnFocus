/**
 * HomePreviewEmpty.tsx — shared empty-state block for Home's preview cards.
 *
 * Renders one consistent empty state as a single left-aligned, indented text row
 * (debug-note 2026-07-21: no centred icon disc) so an empty Notes/Plans/Shopping
 * card reads like the first row of a list waiting to be filled, not a big blank
 * band. A short domain-tinted tick marks where a real row's leading element would
 * sit. Centred vertically within the card's collapsed resting height.
 *
 * Connections:
 *   Imports → constants/theme (FontSize, Fonts, Radius, Spacing), lib/useAppTheme
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard, components/PlanTaskCard
 *             (each card's empty branch)
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - `domainColor` is the {accent, soft} triad from lib/domainColor.getDomainColor —
 *     only `accent` is used now (the leading tick), keeping each empty state's domain hue.
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

export default function HomePreviewEmpty({ text, domainColor }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.tick, { backgroundColor: domainColor.accent }]} />
        <Text style={[styles.text, { color: theme.textMuted }]}>{text}</Text>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // flex:1 lets the row centre vertically within the card's resting-height floor.
  wrap: { flex: 1, justifyContent: 'center', paddingVertical: Spacing.md },
  // Indented so the copy sits where a real list row's text would start.
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.sm },
  // Faint domain-tinted marker standing in for a row's leading element.
  tick: { width: 3, height: 16, borderRadius: Radius.full, opacity: 0.5 },
  text: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'left', flex: 1 },
});
