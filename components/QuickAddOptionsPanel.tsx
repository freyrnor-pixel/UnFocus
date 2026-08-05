/**
 * QuickAddOptionsPanel.tsx — the dense grid holding a quick-add's option cells.
 *
 * **Grid, 2026-08-05 (card design reset, maintainer brief point 5: options "have to be compact…
 * related options next to each other, and no open space").** This used to be a vertical stack
 * with a hairline divider between each full-width row — four options made a tall panel whose
 * right half was empty. It is now a wrapping grid: cells pair two-per-line, `flexGrow` so an
 * odd last cell fills its line instead of leaving a hole, and each cell brings its own border
 * (components/QuickAddOptionRow.tsx) rather than sharing a drawn divider.
 *
 * **Adjacency is the caller's to control.** Flexbox pairs cells in the order it is given them,
 * so "related options next to each other" is satisfied by the order the caller passes children
 * in — this component deliberately has no grouping API. If a pairing looks wrong, reorder the
 * children at the call site; don't add a `group` prop here.
 *
 * Connections:
 *   Imports → constants/theme (Spacing), react-native
 *   Used by → components/PadTypeRow.tsx, components/AddRow.tsx (the `panel` prop both render)
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - No theme dependency any more: the cells own their borders, so this is pure layout. Keep
 *     it that way — a background or border here would box the grid inside the card's own box.
 *   - The gap is `Spacing.xs` in both axes and matches the row gap components/PadSheet.tsx uses
 *     between its boxes, so a card's rows and its option cells sit on the same rhythm.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';

export default function QuickAddOptionsPanel({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
});
