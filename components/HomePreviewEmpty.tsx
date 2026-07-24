/**
 * HomePreviewEmpty.tsx — shared empty-state block for Home's preview cards.
 *
 * Renders a row of ghost placeholder rows — a dot + a bar, shaped like a real task/note/
 * shopping row — instead of an empty-state message (2026-07-24: a text sentence read as a
 * dead end; a "shape of what would be there" reads as inviting and sets the expectation of
 * what filling the card looks like, without asking the user to parse a sentence). Centred
 * vertically within the card's collapsed resting height. The original message is kept as the
 * block's accessibility label so screen-reader users still get the explanation text-readers
 * never rendered.
 *
 * Connections:
 *   Imports → constants/theme (Radius, Spacing), lib/useAppTheme
 *   Used by → components/HomeNotesCard, components/HomeShoppingCard, components/PlanTaskCard
 *             (each card's empty branch)
 *   Data    → none (pure presentational)
 *
 * Edit notes:
 *   - `domainColor` is the {accent, soft} triad from lib/domainColor.getDomainColor,
 *     kept in the prop signature for callers but currently unused now that the ghost rows
 *     are domain-neutral (theme.border/surfaceMuted), matching the neutral tone the old
 *     text-box used.
 *   - Purely visual: keep it free of store/i18n access — callers still pass the already
 *     localised `text` (e.g. t.notes.emptyState); it's used as `accessibilityLabel` only now.
 *   - Row widths (`ROW_WIDTHS`) step down and fade (decreasing opacity) top to bottom so the
 *     block reads as trailing off rather than three identical bars.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** Already-localised empty message — used as the block's accessibility label. */
  text: string;
  /** Domain hue pair from getDomainColor(theme, domain). */
  domainColor: { accent: string; soft: string };
};

const ROW_WIDTHS = [0.7, 0.5, 0.35];

export default function HomePreviewEmpty({ text }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={text}>
      {ROW_WIDTHS.map((w, i) => (
        <View key={i} style={[styles.row, { opacity: 1 - i * 0.3 }]}>
          <View style={[styles.dot, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]} />
          <View style={[styles.bar, { width: `${w * 100}%`, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} />
        </View>
      ))}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // flex:1 lets the block centre vertically within the card's resting-height floor.
  wrap: { flex: 1, justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 16, height: 16, borderRadius: Radius.full, borderWidth: 1.5 },
  bar: { height: 12, borderRadius: Radius.sm, borderWidth: 1 },
});
