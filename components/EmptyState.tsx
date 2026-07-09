/**
 * EmptyState.tsx — illustrated empty-list placeholder.
 *
 * Renders an icon glyph with a title and optional supporting body text below it, plus
 * an optional action button — used for any list/screen that can be legitimately empty
 * (no items yet, no search results, etc.) so it reads as "nothing here yet" rather than
 * a blank, possibly-broken screen.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/Button
 *   Used by → app/shopping.tsx, app/(tabs)/health.tsx (embedded Habits section's week/month views)
 *
 * Edit notes:
 *   - `action` delegates entirely to Button (variant/size chosen by caller via extra props
 *     if needed — this just wires label/onPress into a primary "md" Button).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';

type Props = {
  title: string;
  body?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number;
  action?: { label: string; onPress: () => void };
};

export default function EmptyState({ title, body, icon = 'file-tray-outline', size = 48, action }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={size} color={theme.textMuted} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: theme.textMuted }]}>{body}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="primary" size="md" style={styles.action} /> : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.sm,
  },
});
