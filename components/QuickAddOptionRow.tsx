/**
 * QuickAddOptionRow.tsx — one full-width, readable row in a quick-add options panel.
 *
 * Replaces the icon-only chips that used to sit beside a quick-add field (a bare `--:--`
 * time box, a repeat glyph abbreviated to a single letter, a plain clock icon for task/
 * moment, a plain icon-only energy toggle) — user report: "I cannot understand small,
 * barely visible icons... use a bit of text/words and [be] easily readable." A row reads
 * icon + word on the left, the current value on the right (muted when unset, accent-tinted
 * once set), same shape as PadRow's label/value convention. `onPress` is optional so the
 * Time row can carry an interactive `TimeBoxInput` as its `value` instead of a static string
 * and a press handler (tapping IS the control there).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, @expo/vector-icons, components/PressableScale
 *   Used by → components/PlanTaskCard.tsx, components/HomeHabitsCard.tsx,
 *             app/(tabs)/habits.tsx, app/(tabs)/plans.tsx (quick-add options panels)
 *   Data    → none — presentational; caller owns the value and the press handler
 *
 * Edit notes:
 *   - Rows are meant to be stacked directly (no gap) with `QuickAddOptionsPanel` drawing the
 *     hairline divider between them — don't add spacing here or dividers double up.
 *   - `MIN_TAP_TARGET` height even though the row also reads as text — DESIGN_RULES.md rule 17.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, MIN_TAP_TARGET, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Current value text (e.g. "Weekly", "Task"), or a live control (TimeBoxInput). */
  value: string | React.ReactNode;
  /** Muted/unset styling for the value — used when value is a plain string and nothing's
   *  been chosen yet (e.g. "Off", "--:--"). Ignored when value is a React node. */
  isSet?: boolean;
  accent: string;
  onPress?: () => void;
  /** Draws a trailing "›" — the row opens a picker rather than changing something in place.
   *  Without it a pressable row looks identical to one whose `value` is a live control, which
   *  is how the old tap-cycle rows managed to hide that they were cycling. Only meaningful
   *  alongside `onPress`. */
  showsMore?: boolean;
  accessibilityLabel?: string;
};

export default function QuickAddOptionRow({
  icon,
  label,
  value,
  isSet,
  accent,
  onPress,
  showsMore,
  accessibilityLabel,
}: Props) {
  const theme = useAppTheme();
  const valueIsText = typeof value === 'string';

  const content = (
    <View style={styles.row}>
      <View style={styles.left}>
        <Ionicons name={icon} size={16} color={theme.textMuted} />
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      </View>
      <View style={styles.right}>
        {valueIsText ? (
          <Text
            style={[styles.value, { color: isSet ? accent : theme.textMuted }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {showsMore ? (
          <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TAP_TARGET,
    paddingVertical: Spacing.xs,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Holds the value and the optional "›" together, so a row that grows a chevron doesn't
  // push its value away from the right edge (space-between would put the gap in between).
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1, minWidth: 0 },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  value: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
});
