/**
 * SlideSelector.tsx — the segmented "slider" control for the Tasks/Oppgaver screen.
 *
 * N options in a pill track: a solid accent fill sits on the selected segment, the
 * rest keep a muted, recessed background. Distinct from FormControls.SegmentedControl
 * (which raises the active segment to a light surface) — this is the darker-fill look
 * the Tasks redesign spec calls for. Used for Day/Week/Month, the monthly day|ordinal
 * sub-toggle, the week-interval (1/2/3), and Normal/Important.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → components/TaskCard.tsx
 *   Data    → none (controlled; value/options/onChange from props)
 *
 * Edit notes:
 *   - Values are compared with ===; label is caller-localized.
 *   - `compact` shrinks padding/font for the tight week-interval / ordinal rows.
 */
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

export type SlideOption<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  options: SlideOption<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  compact?: boolean;
};

export default function SlideSelector<T extends string | number>({
  options,
  value,
  onChange,
  style,
  disabled,
  compact,
}: Props<T>) {
  const theme = useAppTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.surfaceMuted, opacity: disabled ? 0.5 : 1 }, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            style={[
              styles.segment,
              compact && styles.segmentCompact,
              active && { backgroundColor: theme.accent },
            ]}
            onPress={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
          >
            <Text
              numberOfLines={1}
              style={[
                compact ? styles.labelCompact : styles.label,
                { color: active ? theme.accentInk : theme.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  segmentCompact: {
    minHeight: 32,
  },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  labelCompact: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
