/**
 * AddRow.tsx — the ONE "add a row" affordance (design criteria 2, 3, 4).
 *
 * An empty input row with a confirm button inside it, mounted as the last row of
 * whatever list/section it feeds — so the add control stays visually connected to
 * the thing it adds to (criterion 1) and the app has a single add-a-row shape
 * everywhere instead of the old mix (floating AddFAB, AddDivider line+dot, dashed
 * "new" cards). Extracted from the WeekListCard inline-add pattern.
 *
 * The confirm button is muted while the input is empty and fills with `accent`
 * (default theme.good) once there's text. It defaults to a "+" glyph; callers whose
 * row already shows a +/− stepper in `extras` pass confirmIcon="checkmark" so two
 * identical "+" buttons never sit adjacent (criterion 6).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/i18n, components/PressableScale, @expo/vector-icons
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx, app/(tabs)/health.tsx,
 *             app/automations.tsx, app/health-log.tsx, app/inventory-edit.tsx
 *             (replaces AddDivider + the floating/inline AddFAB + dashed new-cards)
 *   Data    → none — presentational; fires onSubmit
 *
 * Edit notes:
 *   - Mount inside the section's Surface (like ExpandableCard) — do NOT wrap it in
 *     its own card, or the add row detaches from its list.
 *   - `accent` should come from lib/domainColor.getDomainColor(theme, domain).accent
 *     so the confirm fill matches the screen's identity color.
 *   - Confirm target is padded to ≥44px; the row itself is minHeight 44.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Spacing, contrastOn } from '@/constants/theme';
import PressableScale from '@/components/PressableScale';

type Props = {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** Confirm-fill color when the input is non-empty (default theme.good). */
  accent?: string;
  /** Icon on the confirm button. Use "checkmark" when `extras` contains a +/− stepper. */
  confirmIcon?: keyof typeof Ionicons.glyphMap;
  /** Optional controls rendered between the input and the confirm button (e.g. a qty stepper). */
  extras?: React.ReactNode;
  /** Hairline top divider so the row reads as appended to the list above (default true). */
  showDivider?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function AddRow({
  placeholder,
  value,
  onChangeText,
  onSubmit,
  disabled,
  accent,
  confirmIcon = 'add',
  extras,
  showDivider = true,
  accessibilityLabel,
  style,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const active = value.trim().length > 0 && !disabled;
  const fill = accent ?? theme.good;

  return (
    <View
      style={[
        styles.row,
        showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
        disabled && styles.gated,
        style,
      ]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => active && onSubmit()}
        editable={!disabled}
      />
      {extras}
      <PressableScale
        style={[styles.confirm, { backgroundColor: active ? fill : theme.surfaceMuted }]}
        onPress={onSubmit}
        disabled={!active}
        hitSlop={8}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? t.a11yAdd}
      >
        <Ionicons
          name={confirmIcon}
          size={18}
          color={active ? contrastOn(fill) : theme.textMuted}
        />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
  },
  confirm: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gated: { opacity: 0.45 },
});

// Re-exported so callers building a qty stepper for the `extras` slot match AddRow's metrics.
export const addRowStyles = StyleSheet.create({
  qtyGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: FontSize.md, fontFamily: Fonts.bold, lineHeight: 20 },
  qtyVal: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, minWidth: 20, textAlign: 'center' },
});
