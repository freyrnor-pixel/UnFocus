/**
 * TagChip.tsx — the one way a tag is drawn (2026-07-28, to-do sharing phase 2).
 *
 * A tag's word in a neutral outlined pill, in the two sizes the app needs: `small` for a
 * cue on a task row (where it sits beside a person dot and a goal glow), and the default
 * for the picker and filter rows. Mirrors components/PersonChip.tsx's shape so a "For"
 * row and a "Tagged" row read as the same kind of control.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme, lib/useAppTheme
 *   Used by → components/TagPickerRow.tsx, components/TaskCard.tsx (row cue),
 *             app/plans.tsx (tag filter row), app/settings.tsx (Tags card)
 *   Data    → none — presentational; the caller passes the resolved tag
 *
 * Edit notes:
 *   - **No colour, deliberately.** A tag is told apart by its word, not its hue — see
 *     lib/tags.ts's header for why (the border, status rail, person dot and goal dot have
 *     already taken every colour channel a task row can carry). A SELECTED chip fills with
 *     `theme.accent`, which is selection state, not tag identity: every selected tag gets
 *     the same fill.
 *   - The small variant drops to `FontSize.xs` and tighter padding so several tags fit on a
 *     collapsed row without pushing the title into a second line. Rows cap how many they
 *     draw; this component never decides that.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, Radius, Spacing, contrastOn } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** The tag's name, already resolved. */
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Tighter type/padding for an inline cue on a task row. */
  small?: boolean;
  /** Draws a leading ＋ — used by the "new tag" affordance in the picker. */
  add?: boolean;
  /** Trailing element — e.g. a remove button in Settings' Tags card. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function TagChip({
  label,
  selected = false,
  onPress,
  small = false,
  add = false,
  right,
  style,
}: Props) {
  const theme = useAppTheme();
  const background = selected ? theme.accent : theme.surfaceMuted;
  const border = selected ? theme.accent : theme.border;
  const ink = selected ? contrastOn(background) : theme.textMuted;
  const size = small ? FontSize.xs : FontSize.sm;

  const body = (
    <View
      style={[
        styles.chip,
        small ? styles.chipSmall : null,
        { backgroundColor: background, borderColor: border },
        style,
      ]}
    >
      {add ? <Ionicons name="add" size={size + 2} color={ink} /> : null}
      <Text style={[styles.text, { color: ink, fontSize: size }]} numberOfLines={1}>
        {label}
      </Text>
      {right}
    </View>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      scaleTo={0.96}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipSmall: { paddingVertical: 1, paddingHorizontal: Spacing.xs },
  text: { fontFamily: Fonts.medium },
});
