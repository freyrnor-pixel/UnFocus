/**
 * AddDivider.tsx — small grey "+" flanked by divider lines.
 *
 * Replaces the accent AddFAB at inline "add a row here" spots inside a list/stack
 * (as opposed to AddFAB's own screen-level floating-action role, which is untouched).
 * The flanking lines make it double as a visual separator between adjacent cards,
 * so the same component can be dropped once per item (Plans/Health, one per card)
 * or once per list (Shopping's existing single add-row spots).
 *
 * Pass `label` to show a text label beside the "+" — useful as a first-render hint
 * on empty screens where the tiny button alone is too easy to miss.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → (not yet mounted — Phase 3a foundational port; screens wire this in later)
 *   Data    → none — purely presentational, fires onPress
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/useAppTheme';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

type Props = { onPress: () => void; disabled?: boolean; label?: string };

export default function AddDivider({ onPress, disabled, label }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, disabled && styles.gated]} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
      <Pressable
        onPress={onPress}
        style={[styles.button, { backgroundColor: theme.surfaceMuted }, !!label && styles.buttonLabeled]}
        hitSlop={label ? 4 : 6}
      >
        <Text style={[styles.plus, { color: theme.textMuted }]}>+</Text>
        {label && (
          <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
        )}
      </Pressable>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  line: { flex: 1, height: 1 },
  button: { width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  buttonLabeled: {
    width: 'auto',
    height: 32,
    borderRadius: Radius.full,
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    gap: 4,
  },
  plus: { fontSize: 14, fontFamily: Fonts.bold },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  gated: { opacity: 0.45 },
});
