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
 *   Used by → app/(tabs)/shopping.tsx, app/health-log.tsx, app/(tabs)/habits.tsx (Week/Month
 *             section's week/month views)
 *
 * Edit notes:
 *   - `action` delegates entirely to Button (variant/size chosen by caller via extra props
 *     if needed — this just wires label/onPress into a primary "md" Button).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';

type Props = {
  title: string;
  body?: string;
  /**
   * ⚠️ **Opt-in since 2026-09-08, and it used to default to a 48px `file-tray-outline`.**
   * v2's fix line for the Shop tab is *"Empty state is one line and one button"*, and its `.empty`
   * is exactly that: a dashed box, one 12.5px line, one button — no illustration. The glyph was
   * the biggest thing on several otherwise-quiet screens and said nothing the line did not.
   * Pass one only where the icon carries meaning the sentence cannot.
   */
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number;
  action?: { label: string; onPress: () => void };
};

export default function EmptyState({ title, body, icon, size = 28, action }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  return (
    // v2's `.empty`: `border: 1px dashed`, `border-radius: 14`, centred. The dashed edge is what
    // says "a container that is meant to hold something" rather than "a panel that is finished" —
    // the distinction the old bare line could not draw and the old illustration overstated.
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      {icon ? <Ionicons name={icon} size={size} color={theme.textMuted} /> : null}
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
    // v2's `.empty` box: `padding: 12`, `border-radius: 14`, `1px dashed`. The old shape was
    // `paddingVertical: Spacing.xl` and nothing else — a tall, unbounded gap that only read as
    // an empty state because of the illustration standing in the middle of it.
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
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
