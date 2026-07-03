/**
 * HintCard.tsx — dismissible inline helper card shown on most screens.
 *
 * Renders a flat, bordered hint with an info icon and a left accent bar —
 * deliberately flatter than the elevated/material function cards so hints
 * read as "explanation", not "content". Returns null when the user has
 * disabled hints, so screens can mount it unconditionally.
 *
 * Connections:
 *   Imports → constants/theme, store/useSettingsStore, lib/useAppTheme
 *   Used by → (no current mounts) — Decision 030 closed Decision 010: HintCard reach is
 *             "by demonstrated need," not blanket-per-screen. The shopping mount was dropped
 *             (its mark-then-confirm flow is taught by the weekly empty-state copy). scan.tsx
 *             and notes.tsx are candidates only if their flow can't be made self-evident.
 *   Data    → reads showHints from useSettingsStore (no writes); colours from
 *             useAppTheme(); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Gated on showHints; renders nothing when hints are off — callers should still pass text/example.
 *   - text/example are passed in already-localized; this component does not call useT() itself.
 *   - Uses theme.hintBg/hintBorder/hintAccent (Decision 006 token layer) —
 *     theme-tuned per palette, not a fixed hue.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  text: string;
  example?: string;
};

export default function HintCard({ text, example }: Props) {
  const showHints = useSettingsStore((s) => s.showHints);
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  if (!showHints) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}>
      <View style={[styles.accentBar, { backgroundColor: theme.hintAccent }]} />
      <Ionicons name="information-circle-outline" size={16} color={theme.hintAccent} style={styles.icon} />
      <View style={styles.body}>
        <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
        {example ? <Text style={[styles.example, { color: theme.textMuted }]}>{example}</Text> : null}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
    marginBottom: Spacing.sm,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: Spacing.sm,
  },
  icon: {
    marginTop: 2,
    marginRight: Spacing.xs,
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
  },
  text: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '500',
  },
  example: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
