/**
 * AddRow.tsx — the ONE "add a row" affordance (design criteria 2, 3, 4).
 *
 * An empty input row with a confirm button inside it, mounted as the last row of
 * whatever list/section it feeds — so the add control stays visually connected to
 * the thing it adds to (criterion 1) and the app has a single add-a-row shape
 * everywhere instead of the old mix (floating AddFAB, AddDivider line+dot, dashed
 * "new" cards). Extracted from the WeekListCard inline-add pattern.
 *
 * The confirm button is a raised, pressable-looking control (surface fill + Shadow.button
 * + a light top edge) while the input is empty, and fills with `accent` (default theme.good)
 * once there's text — depth "toward the user", not a recessed well. It defaults to a "+" glyph; callers whose
 * row already shows a +/− stepper in `extras` pass confirmIcon="checkmark" so two
 * identical "+" buttons never sit adjacent (criterion 6).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/i18n, components/PressableScale,
 *             components/ScreenScaffold (ScrollToEndContext), @expo/vector-icons
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
 *   - **Keyboard-avoidance (2026-07-13, fixes taps going dead)**: since this row is always
 *     the LAST item of its list, Android's default `windowSoftInputMode=resize` can leave
 *     it hidden behind the keyboard once it opens (the viewport shrinks but nothing scrolls
 *     to compensate) — the input+confirm button silently become untappable. On focus, this
 *     component asks the enclosing ScreenScaffold (via ScrollToEndContext) to scroll itself
 *     into view, both immediately (keyboard-already-open case) and again on `keyboardDidShow`
 *     (keyboard-opening-fresh case).
 */
import React, { useContext, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing, contrastOn } from '@/constants/theme';
import PressableScale from '@/components/PressableScale';
import { ScrollToEndContext } from '@/components/ScreenScaffold';

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

  // Scroll this row above the keyboard once it opens, but only while THIS row's input is
  // the one focused (a screen may have other, unrelated inputs elsewhere that shouldn't
  // trigger it). See ScreenScaffold.tsx's ScrollToEndContext doc for why this is needed.
  const scrollToEnd = useContext(ScrollToEndContext);
  const isFocusedRef = useRef(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isFocusedRef.current) scrollToEnd?.();
    });
    return () => sub.remove();
  }, [scrollToEnd]);

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
        onFocus={() => {
          isFocusedRef.current = true;
          // Covers the keyboard-already-open case (switching focus to this input doesn't
          // re-fire keyboardDidShow); the listener above covers the keyboard-opening-fresh
          // case. Harmless to call both — scrollToEnd() is idempotent.
          scrollToEnd?.();
        }}
        onBlur={() => { isFocusedRef.current = false; }}
      />
      {extras}
      <PressableScale
        style={[
          styles.confirm,
          Shadow.button,
          {
            // Raised, pressable-looking button: a real fill (never the recessed surfaceMuted)
            // + a light top edge so it reads as lifted toward the user, not a sunken well.
            backgroundColor: active ? fill : theme.surface,
            borderTopColor: 'rgba(255,255,255,0.6)',
          },
        ]}
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
    borderTopWidth: 1,
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
