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
 *             components/EnergyMeter.tsx, components/HomeShoppingCard.tsx,
 *             components/ShoppingItemSheet.tsx, app/settings.tsx, app/habit-form.tsx,
 *             app/medicine-form.tsx
 *   Data    → none (controlled — parent owns the value)
 *
 * Edit notes:
 *   - **Both buttons are `theme.surfaceMuted` + `theme.border` (2026-08-01, addendum B.1)**.
 *     The "+" used to carry a solid `theme.accent` fill while the "−" was muted. That made
 *     an increment button the loudest thing on any surface that hosts a stepper — a Stepper
 *     appears on Home (the shopping card, the Energy meter), on To-do (TaskCard's energy
 *     cost) and in half the forms/sheets, so a single accent-filled "+" was competing with
 *     each of those screens' actual primary action, several times over on a list. A stepper
 *     is a PAIRED control: filling one half in the app's action colour and not the other
 *     read as "+ is the important one", which is not true. Symmetric now, and the ± glyphs
 *     carry the meaning. Same substitution applied at the three hand-rolled copies of this
 *     control — components/MonthlyTableRow.tsx, components/InlineAddItem.tsx,
 *     components/UpdateSheet.tsx and components/MonthlyResetReviewSheet.tsx — so every
 *     stepper in the app looks the same. Don't reinstate the accent fill on one of them.
 *   - **Button border (2026-07-25)**: `theme.surfaceMuted` has no contrast of its own against
 *     most parent surfaces — missed by the 2026-07-24 "near-invisible borders" pass, which
 *     fixed the same bug in habits.tsx's own local adjuster button but not this shared
 *     component. Both call sites now pass `theme.border` (the "+" needs it too, now that it
 *     no longer has an accent fill to define its own edge).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, Radius, Spacing, HitSlop } from '@/constants/theme';
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
        hitSlop={HitSlop.snug}
        scaleTo={0.9}
        accessibilityRole="button"
        style={[styles.btn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, atMin && styles.disabled]}
      >
        <Text style={[styles.btnText, { color: theme.text }]}>−</Text>
      </PressableScale>
      <Text style={[styles.value, { color: theme.text }]}>
        {signed && value > 0 ? `+${value}` : value}{suffix ? ` ${suffix}` : ''}
      </Text>
      <PressableScale
        onPress={inc}
        disabled={atMax}
        hitSlop={HitSlop.snug}
        scaleTo={0.9}
        accessibilityRole="button"
        style={[styles.btn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, atMax && styles.disabled]}
      >
        <Text style={[styles.btnText, { color: theme.text }]}>+</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // borderColor defaults transparent and BOTH call sites override it to theme.border: the
  // shared surfaceMuted fill has no visible edge of its own against most parent surfaces
  // (matches the fix applied to habits.tsx's own adjuster button, 2026-07-24). Before the
  // 2026-08-01 accent pass only the "−" needed it — the "+" defined its own edge with an
  // accent fill. See the edit note above for why that fill is gone.
  btn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  btnText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  value: { minWidth: 36, textAlign: 'center', fontSize: FontSize.md, fontFamily: Fonts.semibold },
  disabled: { opacity: 0.4 },
});
