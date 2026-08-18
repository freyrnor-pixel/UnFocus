/**
 * QuickAddOptionRow.tsx — one bordered cell in a quick-add's dense options grid.
 *
 * **Grid cell, 2026-08-05 (card design reset, maintainer brief point 5: options "have to be
 * compact… related options next to each other, and no open space", plus point 9's borders).**
 * This was a full-width row: icon + word on the left, value on the right, and the whole right
 * half of every row empty. Four options meant four 44px rows and a tall panel of mostly
 * nothing. It is now a compact bordered cell that pairs up two-per-line, stacking its label
 * over its value so a half-width cell still reads at a glance.
 *
 * The name is now a small lie — it is a cell, not a row — and is kept only because renaming it
 * would churn six call sites for no behavioural gain. If you are touching all of them anyway,
 * rename it then.
 *
 * Connections:
 *   Imports → constants/theme (BORDER_WIDTH, computeBorderTone, FontSize, Fonts,
 *             MIN_TAP_TARGET, Radius, Spacing), lib/useAppTheme, lib/screenColor,
 *             @expo/vector-icons, components/PressableScale
 *   Used by → components/QuickAddOptionsPanel.tsx (the grid), and through it
 *             components/PadTypeRow.tsx + components/AddRow.tsx, hence
 *             components/PlanTaskCard.tsx, components/HomeHabitsCard.tsx,
 *             app/habits.tsx, app/plans.tsx
 *   Data    → none — presentational; the caller owns the value and the press handler
 *
 * Edit notes:
 *   - **Cells no longer stack flush and the panel no longer draws dividers.** Each cell brings
 *     its own border at the FIELD rung of the screen's hue — the same border
 *     components/PadSheet.tsx gives a row — and QuickAddOptionsPanel spaces them. Don't re-add
 *     a divider here or between them; a bordered cell with a divider beside it reads as two
 *     separate lines.
 *   - **`wide` is for a cell whose value is a live control or a long string** (the Time row's
 *     `TimeBoxInput`, a destination list name). A half-width cell truncates those, so they take
 *     the whole line instead. Use it sparingly — every `wide` cell is a line that can't be
 *     paired, which is how open space creeps back in.
 *   - **"No open space" is the grid's job, not the cell's**: cells `flexGrow`, so an odd last
 *     cell stretches to fill its line rather than leaving a hole. That's why the basis below is
 *     a percentage under 50 and not a fixed width.
 *   - `MIN_TAP_TARGET` height even though a cell also reads as text — DESIGN_RULES.md rule 17.
 *   - `onPress` is optional: the Time cell carries an interactive `TimeBoxInput` as its `value`
 *     instead of a press handler, because tapping the control IS the interaction there.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { BORDER_WIDTH, computeBorderTone, FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { useScreenColor } from '@/lib/screenColor';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Current value text (e.g. "Weekly", "Task"), or a live control (TimeBoxInput). */
  value: string | React.ReactNode;
  /** Muted/unset styling for the value — used when value is a plain string and nothing's been
   *  chosen yet (e.g. "Off", "--:--"). Ignored when value is a React node. */
  isSet?: boolean;
  accent: string;
  onPress?: () => void;
  /** Takes the full line instead of pairing up — for a live control or a long value. */
  wide?: boolean;
  /** Draws a trailing "›" — the cell opens a picker rather than changing something in place.
   *  Without it a pressable cell looks identical to one whose `value` is a live control, which
   *  is how the old tap-cycle rows managed to hide that they were cycling. */
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
  wide,
  showsMore,
  accessibilityLabel,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const hue = useScreenColor() ?? theme.border;
  const valueIsText = typeof value === 'string';

  const content = (
    <View
      style={[
        styles.cell,
        wide ? styles.wide : styles.half,
        {
          borderWidth: BORDER_WIDTH.field,
          borderColor: computeBorderTone(hue, isDark, 'field'),
          borderRadius: Radius.sm,
        },
      ]}
    >
      <View style={styles.labelLine}>
        <Ionicons name={icon} size={14} color={theme.textMuted} />
        <Text style={[styles.label, { color: theme.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.valueLine}>
        {valueIsText ? (
          <Text style={[styles.value, { color: isSet ? accent : theme.textMuted }]} numberOfLines={1}>
            {value}
          </Text>
        ) : (
          value
        )}
        {showsMore ? <Ionicons name="chevron-forward" size={13} color={theme.textMuted} /> : null}
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
      // The growth keys live on the PRESSABLE when there is one, not on the cell inside it:
      // a Pressable that hugs its content would leave the cell at its natural width and the
      // grid would go ragged, which is the open space point 5 is about.
      style={wide ? styles.wide : styles.half}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cell: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 2,
  },
  // Under half, so two cells plus the grid's gap fit one line; `flexGrow` then expands them to
  // fill it exactly, and an odd last cell stretches the whole way rather than leaving a hole.
  half: { flexGrow: 1, flexShrink: 1, flexBasis: '46%', minWidth: 0 },
  wide: { flexGrow: 1, flexShrink: 1, flexBasis: '100%', minWidth: 0 },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  valueLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minWidth: 0 },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.medium, flexShrink: 1 },
  value: { fontSize: FontSize.sm, fontFamily: Fonts.bold, flexShrink: 1 },
});
