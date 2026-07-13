/**
 * SectionRail.tsx — color-rail section header: a hue dot + label (+ optional count / right slot).
 *
 * The header half of the 2026-07-13 "color rail" list redesign (Tasks screen first, meant as
 * the reusable section primitive for the other list screens too). Pairs with a stack of cards
 * that each carry a matching `railColor` left edge — the shared hue is what binds a header to
 * its rows, replacing the old flat-color pill (`sectionHeader()` in plans.tsx). The `hue` is a
 * domain accent from lib/domainColor.getDomainColor(theme, domain).accent, which has both a
 * light and a dark variant, so the label/dot stay distinct and legible in both modes.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/plans.tsx, components/SharedTasksSection.tsx
 *             (adopt on Shopping/Health/Habits section headers for a consistent structure)
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - `hue` should be a solid domain accent (works on any surface, both modes). The row now
 *     sits on a soft pill of that same hue (`rgba(hue, 0.14)`) so the header reads as a
 *     labelled plate on the backdrop instead of bare text; the solid-`hue` label stays legible
 *     over its own 14% tint. Pass a solid accent, not an already-translucent colour.
 *   - Default the pill hugs its label (alignSelf flex-start); passing `right` stretches it
 *     full-width so the right-slot control's `marginLeft:'auto'` still pushes to the edge.
 *   - `count` is optional; omit it for sections where a tally adds noise (e.g. weekday groups).
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Fonts, FontSize, Radius, Spacing, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Solid domain accent (getDomainColor(theme, domain).accent). Colors the dot + label. */
  hue: string;
  label: string;
  /** Optional item tally shown after the label. */
  count?: number;
  /** Optional control rendered flush-right (e.g. a toggle). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SectionRail({ hue, label, count, right, style }: Props) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: rgba(hue, 0.14) },
        // Hug the label as a pill by default; stretch full-width when a right-slot
        // control is present (its marginLeft:'auto' needs the row to span the width).
        right ? styles.rowStretch : styles.rowHug,
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: hue }]} />
      <Text style={[styles.label, { color: hue }]}>{label}</Text>
      {count != null && (
        <Text style={[styles.count, { color: theme.textMuted }]}>{count}</Text>
      )}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Soft domain-tinted pill so the header reads as a labelled plate on the backdrop
  // instead of bare text floating on the background.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  rowHug: { alignSelf: 'flex-start' },
  rowStretch: { alignSelf: 'stretch' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  count: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  right: { marginLeft: 'auto' },
});
