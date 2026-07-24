/**
 * HomePreviewEmpty.tsx — shared empty-state block for Home's preview cards.
 *
 * Renders the (already-localised) empty message, centred within the card's collapsed
 * resting height.
 *
 * Connections:
 *   Imports → constants/theme (FontSize, Fonts, Spacing), lib/useAppTheme
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard, components/PlanTaskCard
 *             (each card's empty branch)
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - **Reverted from skeleton ghost rows (2026-07-24, user report)**: a previous pass rendered
 *     three shrinking placeholder bars here, meant to read as "the shape of what would be
 *     there" — but skeleton/ghost rows are a loading-state convention everywhere else (this
 *     app included), so showing them for a genuinely empty list read as a stuck loading
 *     spinner, not "nothing here yet".
 *   - **Reverted the icon too (2026-07-24, same-day follow-up, user report)**: the very next
 *     pass added a domain icon above the message, reusing `CardAccentBadge`'s own glyph so it
 *     "matched" the card's header badge — but "matched" meant identical, and the header badge
 *     already sits a few px above this block in the same card, so the same icon rendered twice,
 *     stacked, in one card read as a duplication bug, not a design choice. Text alone doesn't
 *     repeat anything already on screen.
 *   - `domainColor` is kept in the prop signature (unused) so callers don't need a churn edit
 *     if a future pass wants it back — matches the same "kept for callers" note this file had
 *     before the icon revert.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** Already-localised empty message. */
  text: string;
  /** Domain hue pair from getDomainColor(theme, domain) — unused, kept for callers. */
  domainColor: { accent: string; soft: string };
};

export default function HomePreviewEmpty({ text }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // flex:1 lets the block centre vertically within the card's resting-height floor.
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md },
  text: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
