/**
 * GhostRow.tsx — inline "deleted, tap to restore" placeholder row.
 *
 * Renders where a just-deleted row used to sit: dimmed, muted title, one restore (undo)
 * affordance on the right — the same shape/colours components/PlanTaskCard.tsx's existing
 * "Recently deleted" zone already uses for its own restore rows, reused here rather than
 * inventing a second undo look. Pairs with lib/useGhostTimeout.ts, which owns the timing
 * (auto-clears after a few seconds or on navigating away); this component is purely
 * presentational and holds no state of its own.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme, lib/i18n, lib/useAppTheme
 *   Used by → app/(tabs)/habits.tsx, app/notes.tsx
 *   Data    → none
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, HitSlop, PAD_ROW_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** The deleted row's own label — usually its title/header. */
  title: string;
  /** Restores the row. The caller owns clearing its own pending-ghost state. */
  onRestore: () => void;
};

export default function GhostRow({ title, onRestore }: Props) {
  const theme = useAppTheme();
  const t = useT();

  return (
    <View style={[styles.row, { backgroundColor: rgba(theme.accent, 0.03), borderColor: theme.border }]}>
      <Text numberOfLines={1} style={[styles.title, { color: theme.textMuted }]}>
        {title}
      </Text>
      <PressableScale
        style={styles.restoreBtn}
        onPress={onRestore}
        hitSlop={HitSlop.base}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${t.dayViewRestore} ${title}`}
      >
        <Ionicons name="arrow-undo-outline" size={16} color={theme.accent} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: PAD_ROW_HEIGHT,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  title: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  restoreBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
