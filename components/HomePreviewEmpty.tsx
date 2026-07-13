/**
 * HomePreviewEmpty.tsx — shared empty-state block for Home's preview cards.
 *
 * Renders one consistent, inviting empty state (a soft domain-tinted icon disc
 * above a muted message) so an empty Notes/Plans/Shopping card reads as an
 * intentional "resting" card rather than a big blank band. Centered in a column
 * that fills the card's collapsed resting height (HOME_PREVIEW_CARD_MIN_HEIGHT).
 *
 * Connections:
 *   Imports → constants/theme (FontSize, Fonts, Radius, Spacing), lib/useAppTheme
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard, components/PlanTaskCard
 *             (each card's empty branch)
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - `domainColor` is the {accent, soft} triad from lib/domainColor.getDomainColor —
 *     the disc uses `soft` as its fill and `accent` for the icon, so every empty
 *     state carries its own domain hue without new tokens.
 *   - Purely visual: keep it free of store/i18n access — callers pass the already
 *     localised `text` (e.g. t.notes.emptyState) and the resolved icon name.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** Ionicons glyph name for the disc (e.g. 'mic-outline', 'cart-outline'). */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Already-localised empty message. */
  text: string;
  /** Domain hue pair from getDomainColor(theme, domain). */
  domainColor: { accent: string; soft: string };
};

export default function HomePreviewEmpty({ icon, text, domainColor }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.wrap}>
      <View style={[styles.disc, { backgroundColor: domainColor.soft }]}>
        <Ionicons name={icon} size={22} color={domainColor.accent} />
      </View>
      <Text style={[styles.text, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // flex:1 lets the block centre within the card's resting-height floor.
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  disc: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', maxWidth: 260 },
});
