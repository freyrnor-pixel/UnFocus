/**
 * QuickAddOptionsPanel.tsx — the stacked-rows container for a quick-add's options
 * (components/QuickAddOptionRow.tsx children), drawn under the pad line's input.
 *
 * Just a divider-drawing wrapper: a hairline `theme.border` line between each row, none
 * after the last, matching the approved dropdown-panel design (icon+word left, value right,
 * one row per option) that replaced the old horizontal icon-chip row.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → components/PadTypeRow.tsx, components/AddRow.tsx (the `panel` prop both render)
 *   Data    → none — presentational
 */
import React, { Children } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/lib/useAppTheme';

export default function QuickAddOptionsPanel({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  const rows = Children.toArray(children);

  return (
    <View style={styles.panel}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={i > 0 && [styles.divider, { borderTopColor: theme.border }]}
        >
          {row}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
});
