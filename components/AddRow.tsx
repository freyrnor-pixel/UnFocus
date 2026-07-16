/**
 * AddRow.tsx — the ONE "add a row" affordance (design criteria 2, 3, 4).
 *
 * An empty input row with a confirm button inside it, mounted at the bottom of (or within)
 * whatever list/section it feeds — so the add control stays visually connected to
 * the thing it adds to (criterion 1) and the app has a single add-a-row shape
 * everywhere instead of the old mix (floating AddFAB, AddDivider line+dot, dashed
 * "new" cards). Extracted from the WeekListCard inline-add pattern. It no longer has to be
 * the strict last item — the keyboard-avoidance below lifts the row itself, not the list end.
 *
 * The confirm button reads as inert while the input is empty — it IS disabled then (submitting
 * needs text), so it's a flat, recessed well (surfaceMuted + a neutral edge, no shadow) rather
 * than masquerading as a ready-to-tap control (an earlier "raised even when empty" look made the
 * disabled state read as a broken/dead button). Once there's text it becomes raised and
 * pressable-looking — fills with `accent` (default theme.good) + Shadow.button + a light top
 * edge, depth "toward the user". It defaults to a "+" glyph; callers whose row already shows a
 * +/− stepper in `extras` pass confirmIcon="checkmark" so two identical "+" buttons never sit
 * adjacent (criterion 6).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/i18n, components/PressableScale,
 *             components/ScreenScaffold (ScrollIntoViewContext), @expo/vector-icons
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
 *   - **Keyboard-avoidance (2026-07-13, fixes taps going dead; 2026-07-16 made row-relative)**:
 *     Android's default `windowSoftInputMode=resize` can leave this row hidden behind the
 *     keyboard once it opens (the viewport shrinks but nothing scrolls to compensate) — the
 *     input+confirm button silently become untappable. On focus (and on `keyboardDidShow`)
 *     this component hands the enclosing ScreenScaffold its OWN View node via
 *     ScrollIntoViewContext, which measures the row and lifts just it above the keyboard.
 *     The earlier version scrolled to the list's absolute END, which only worked when the row
 *     was the last item; #196's per-day InlineTaskAdd rows sit mid-list, so scroll-to-end
 *     scrolled past them and re-broke the taps — measuring the row itself fixes both cases.
 */
import React, { useContext, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing, contrastOn } from '@/constants/theme';
import PressableScale from '@/components/PressableScale';
import { ScrollIntoViewContext } from '@/components/ScreenScaffold';

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

  // Scroll THIS row above the keyboard once it opens, but only while THIS row's input is
  // the one focused (a screen may have other, unrelated inputs elsewhere that shouldn't
  // trigger it). We hand the scaffold this row's own View node so it lifts just this row —
  // correct whether the row is last-in-list or mid-list. See ScreenScaffold's
  // ScrollIntoViewContext doc for why this is needed.
  const scrollIntoView = useContext(ScrollIntoViewContext);
  const rowRef = useRef<View>(null);
  const isFocusedRef = useRef(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isFocusedRef.current) scrollIntoView?.(rowRef.current);
    });
    return () => sub.remove();
  }, [scrollIntoView]);

  return (
    <View
      ref={rowRef}
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
          // case. Harmless to call both — scrollIntoView() is idempotent.
          scrollIntoView?.(rowRef.current);
        }}
        onBlur={() => { isFocusedRef.current = false; }}
      />
      {extras}
      <PressableScale
        style={[
          styles.confirm,
          // Raised & pressable-looking ONLY when there's text to submit: real fill + button
          // shadow + a light top edge so it reads as lifted toward the user. While the input is
          // empty the button is inert (disabled — submitting needs text), so it drops all of that
          // and reads as a flat, recessed well (surfaceMuted + a neutral edge, no shadow) to
          // signal "type something first" instead of masquerading as a ready-to-tap control.
          active && Shadow.button,
          {
            backgroundColor: active ? fill : theme.surfaceMuted,
            borderTopColor: active ? 'rgba(255,255,255,0.6)' : theme.border,
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
