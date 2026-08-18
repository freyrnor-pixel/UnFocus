/**
 * PersonChip.tsx — the one way a person is drawn (2026-07-28, to-do sharing phase 1).
 *
 * A person's identity colour + initials, in the two shapes the app needs: `PersonDot`
 * (just the coloured circle, for an at-a-glance cue on a collapsed row) and `PersonChip`
 * (dot + name in a pill, for the "For" pickers and filter rows). Five surfaces used to
 * each hand-roll their own `['', ...childProfiles]` chip row; they all come here now, so
 * a person looks the same everywhere and a change lands in one place.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme, lib/personColor, lib/useAppTheme
 *   Used by → components/TaskCard.tsx (row cue + the "For" picker), app/plans.tsx
 *             (person filter row), app/settings.tsx (People card), app/habit-form.tsx,
 *             app/medicine-form.tsx, components/MedicineTrayCard.tsx, app/habits.tsx
 *   Data    → none — presentational; the caller passes the resolved person
 *
 * Edit notes:
 *   - The person colour is drawn as a FILLED DOT and, when selected, as the chip's fill.
 *     It must never become a card border — that channel belongs to lib/domainColor.ts, and
 *     a person hue on a card edge would fight the domain hue already there. See
 *     lib/personColor.ts's header for the full three-channel rule.
 *   - `name` is passed already-resolved (including the "Me"/"Everyone" fallbacks), because
 *     only the caller knows whether an empty id means "me" or "everyone".
 *   - When there are no initials to draw (an unnamed person), the dot falls back to a
 *     person glyph rather than rendering an empty circle.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, OpticalCenter, Radius, Spacing, contrastOn } from '@/constants/theme';
import { personInitials } from '@/lib/personColor';
import { useAppTheme } from '@/lib/useAppTheme';

type DotProps = {
  /** Resolved identity hue (lib/personColor.ts's personColor()). */
  color: string;
  /** Person's name — only its initials are drawn. Empty renders the fallback glyph. */
  name: string;
  /** Diameter in px. 18 suits a collapsed row cue, 26 a picker or settings row. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function PersonDot({ color, name, size = 18, style }: DotProps) {
  const initials = personInitials(name);
  const ink = contrastOn(color);
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    >
      {initials ? (
        <Text style={[styles.dotText, { color: ink, fontSize: Math.round(size * 0.46) }]}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.56)} color={ink} />
      )}
    </View>
  );
}

type ChipProps = {
  /** Already-resolved label — "Me"/"Everyone" substitutions belong to the caller. */
  label: string;
  /**
   * Identity hue, or undefined for a person-less chip ("Everyone"), which falls back to
   * the theme's neutral chip colours and draws no dot.
   */
  color?: string;
  /** Name the dot draws initials from; defaults to `label`. */
  name?: string;
  selected?: boolean;
  onPress?: () => void;
  /** Trailing element — e.g. a remove button in Settings' People card. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function PersonChip({
  label,
  color,
  name,
  selected = false,
  onPress,
  right,
  style,
}: ChipProps) {
  const theme = useAppTheme();
  // Selected chips fill with the person's own colour so a filter row reads as a legend for
  // the list below it; unselected chips stay neutral so six people don't shout at once.
  const background = selected ? color ?? theme.accent : theme.surfaceMuted;
  const border = selected ? color ?? theme.accent : theme.border;
  const ink = selected ? contrastOn(background) : theme.text;

  const body = (
    <View style={[styles.chip, { backgroundColor: background, borderColor: border }, style]}>
      {color ? <PersonDot color={selected ? ink : color} name={name ?? label} size={16} /> : null}
      <Text style={[styles.chipText, { color: ink }]} numberOfLines={1}>
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
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotText: { fontFamily: Fonts.semibold, ...OpticalCenter },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
});
