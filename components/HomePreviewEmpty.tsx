/**
 * HomePreviewEmpty.tsx — shared empty-state block for Home's preview cards.
 *
 * Renders a centred domain icon + the (already-localised) empty message — the standard
 * "nothing here yet" pattern most apps use for an empty list. Centred vertically within the
 * card's collapsed resting height.
 *
 * Connections:
 *   Imports → @expo/vector-icons (Ionicons), components/CardAccent (DOMAIN_ICON),
 *             constants/theme (FontSize, Fonts, Radius, Spacing, rgba), lib/useAppTheme
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard, components/PlanTaskCard
 *             (each card's empty branch)
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - **Reverted from skeleton ghost rows (2026-07-24, user report)**: a previous pass rendered
 *     three shrinking placeholder bars here, meant to read as "the shape of what would be
 *     there" — but skeleton/ghost rows are a loading-state convention everywhere else (this
 *     app included), so showing them for a genuinely empty list read as a stuck loading
 *     spinner, not "nothing here yet". Back to icon + message, the pattern users actually
 *     expect from an empty state.
 *   - `domain` selects the glyph via `CardAccentBadge`'s own `DOMAIN_ICON` map, so the empty
 *     icon always matches the card's real header badge glyph.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DOMAIN_ICON } from '@/components/CardAccent';
import { Domain } from '@/lib/domainColor';
import { FontSize, Fonts, Radius, Spacing, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** Already-localised empty message. */
  text: string;
  /** Selects the glyph (same map CardAccentBadge uses), so it matches the card's own badge. */
  domain: Domain;
  /** Domain hue pair from getDomainColor(theme, domain). */
  domainColor: { accent: string; soft: string };
};

export default function HomePreviewEmpty({ text, domain, domainColor }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: domainColor.soft, borderColor: rgba(domainColor.accent, 0.4) }]}>
        <Ionicons name={DOMAIN_ICON[domain]} size={20} color={domainColor.accent} />
      </View>
      <Text style={[styles.text, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // flex:1 lets the block centre vertically within the card's resting-height floor.
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  icon: { width: 40, height: 40, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
});
