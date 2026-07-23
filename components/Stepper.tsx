/**
 * Stepper.tsx — a compact −/value/+ numeric stepper.
 *
 * A small reusable control: a minus button, the current value, and a plus button.
 * Clamps to optional min/max and steps by `step` (default 1). Fires a light haptic
 * tap on each press. Lifted from the inline pattern in components/MonthlyTableRow.tsx
 * so the Energy system (per-task cost in components/TaskCard.tsx, Settings default
 * capacity, the Home meter's per-period override) can share one control.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/haptics, components/PressableScale
 *   Used by → components/TaskCard.tsx (was app/task-form.tsx, retired 2026-07-23),
 *             app/settings.tsx, components/EnergyMeter.tsx
 *   Data    → none (controlled — parent owns the value)
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { tap } from '@/lib/haptics';
import PressableScale from '@/components/PressableScale';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Optional label shown after the value (e.g. an energy unit). */
  suffix?: string;
  /** When true, prefix positive values with '+' so gain/drain reads clearly (e.g. energy). */
  signed?: boolean;
  accessibilityLabel?: string;
};

export default function Stepper({ value, onChange, min, max, step = 1, suffix, signed, accessibilityLabel }: Props) {
  const theme = useAppTheme();

  const clamp = (n: number) => {
    let v = n;
    if (min != null && v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  };
  const dec = () => { tap(); onChange(clamp(value - step)); };
  const inc = () => { tap(); onChange(clamp(value + step)); };

  const atMin = min != null && value <= min;
  const atMax = max != null && value >= max;

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      <PressableScale
        onPress={dec}
        disabled={atMin}
        hitSlop={6}
        scaleTo={0.9}
        accessibilityRole="button"
        style={[styles.btn, { backgroundColor: theme.surfaceMuted }, atMin && styles.disabled]}
      >
        <Text style={[styles.btnText, { color: theme.text }]}>−</Text>
      </PressableScale>
      <Text style={[styles.value, { color: theme.text }]}>
        {signed && value > 0 ? `+${value}` : value}{suffix ? ` ${suffix}` : ''}
      </Text>
      <PressableScale
        onPress={inc}
        disabled={atMax}
        hitSlop={6}
        scaleTo={0.9}
        accessibilityRole="button"
        style={[styles.btn, { backgroundColor: theme.accent }, atMax && styles.disabled]}
      >
        <Text style={[styles.btnText, { color: theme.accentInk }]}>+</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  value: { minWidth: 36, textAlign: 'center', fontSize: FontSize.md, fontFamily: Fonts.semibold },
  disabled: { opacity: 0.4 },
});
