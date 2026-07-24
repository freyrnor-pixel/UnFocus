/**
 * AddRow.tsx — the ONE "add a row" affordance (design criteria 2, 3, 4).
 *
 * A two-state add control mounted at the bottom of (or within) whatever list/section it
 * feeds — so the add control stays visually connected to the thing it adds to (criterion 1)
 * and the app has a single add-a-row shape everywhere instead of the old mix (floating
 * AddFAB, AddDivider line+dot, dashed "new" cards).
 *
 * Two states (2026-07-19, "make + intuitive"): it now COLLAPSES to a labelled "+ <placeholder>"
 * bar by default instead of sitting as a permanent empty input (which read as clutter / an
 * unclear affordance). Tapping the bar EXPANDS it into an editable row — an autofocused input
 * plus two explicit buttons: a **Save** confirm (the old accent-fill button; disabled/recessed
 * until there's text) and a **Delete** discard (neutral "close") that drops the in-progress row.
 * Saving commits via onSubmit and collapses back to the "+" bar (discrete one-row-at-a-time);
 * Delete (or blurring an empty row) also collapses. Both bar and editing row share one fixed
 * ~44px container, so the swap is snappy with no layout jump.
 *
 * The confirm/Save button reads as inert while the input is empty — it IS disabled then
 * (submitting needs text), so it's a flat, recessed well (surfaceMuted + a neutral edge, no
 * shadow) rather than masquerading as a ready-to-tap control. Once there's text it becomes
 * raised and pressable-looking — fills with `accent` (default theme.good) + Shadow.button + a
 * uniform light edge, depth "toward the user". (2026-07-24: was a top-only border, which renders
 * as a stray arc/seam on a fully-rounded circle — switched to a uniform borderWidth all round,
 * matching IconButton's keycap-edge convention.) It defaults to a "+" glyph; callers whose row
 * already shows a +/− stepper in `extras` pass confirmIcon="checkmark" so two identical "+"
 * buttons never sit adjacent (criterion 6).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/i18n, lib/haptics, components/PressableScale,
 *             components/ScreenScaffold (ScrollIntoViewContext), @expo/vector-icons
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx, app/(tabs)/habits.tsx,
 *             app/automations.tsx, app/health-log.tsx,
 *             components/CatalogueTab.tsx
 *             (replaces AddDivider + the floating/inline AddFAB + dashed new-cards)
 *   Data    → none — presentational; fires onSubmit
 *
 * Edit notes:
 *   - Mount inside the section's Surface (like ExpandableCard) — do NOT wrap it in
 *     its own card, or the add row detaches from its list.
 *   - `accent` should come from lib/domainColor.getDomainColor(theme, domain).accent
 *     so the "+" bar glyph and the confirm fill match the screen's identity color.
 *   - Confirm/Delete targets are padded to ≥44px; the row itself is minHeight 44.
 *   - Collapse/expand is an instant content swap (both states share the ~44px row height), so
 *     there's no LinearTransition/Collapsible height animation to get wrong — the intuitive
 *     signal is the autofocus + the appearing Save/Delete buttons. PressableScale supplies the
 *     press haptic on the "+" bar; Save fires confirm() at the commit moment.
 *   - **Keyboard-avoidance (2026-07-13, fixes taps going dead; 2026-07-16 made row-relative)**:
 *     Android's default `windowSoftInputMode=resize` can leave this row hidden behind the
 *     keyboard once it opens (the viewport shrinks but nothing scrolls to compensate) — the
 *     input+confirm button silently become untappable. On focus (and on `keyboardDidShow`)
 *     this component hands the enclosing ScreenScaffold its OWN View node via
 *     ScrollIntoViewContext, which measures the row and lifts just it above the keyboard.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Shadow, Spacing, contrastOn } from '@/constants/theme';
import PressableScale from '@/components/PressableScale';
import { ScrollIntoViewContext } from '@/components/ScreenScaffold';

type Props = {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** Confirm-fill color when the input is non-empty (default theme.good). Also tints the "+" bar. */
  accent?: string;
  /** Icon on the confirm/Save button. Use "checkmark" when `extras` contains a +/− stepper. */
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

  // Collapsed by default: a "+ <placeholder>" bar. Tapping it expands into the editing row.
  const [expanded, setExpanded] = useState(false);

  // Scroll THIS row above the keyboard once it opens, but only while THIS row's input is
  // the one focused (a screen may have other, unrelated inputs elsewhere that shouldn't
  // trigger it). We hand the scaffold this row's own View node so it lifts just this row —
  // correct whether the row is last-in-list or mid-list. See ScreenScaffold's
  // ScrollIntoViewContext doc for why this is needed.
  const scrollIntoView = useContext(ScrollIntoViewContext);
  const rowRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const isFocusedRef = useRef(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isFocusedRef.current) scrollIntoView?.(rowRef.current);
    });
    return () => sub.remove();
  }, [scrollIntoView]);

  const containerStyle = [
    styles.row,
    showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    disabled && styles.gated,
    style,
  ];

  function expand() {
    setExpanded(true);
    // Focus on the next frame — the input mounts this render, so it isn't focusable yet.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function collapse() {
    onChangeText('');
    setExpanded(false);
  }

  function commit() {
    if (!active) return;
    onSubmit();
    hapticConfirm();
    setExpanded(false); // discrete: back to the "+" bar after each save
  }

  // ── Collapsed: labelled "+ <placeholder>" bar ──
  if (!expanded) {
    return (
      <View ref={rowRef} style={containerStyle} pointerEvents={disabled ? 'none' : 'auto'}>
        <PressableScale
          style={styles.addBar}
          onPress={expand}
          disabled={disabled}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? placeholder ?? t.a11yAdd}
        >
          <View style={[styles.addBarChip, { backgroundColor: fill }]}>
            <Ionicons name="add" size={16} color={contrastOn(fill)} />
          </View>
          <Text style={[styles.addBarLabel, { color: theme.textMuted }]} numberOfLines={1}>
            {placeholder}
          </Text>
        </PressableScale>
      </View>
    );
  }

  // ── Expanded: editable row + Save + Delete ──
  return (
    <View
      ref={rowRef}
      style={containerStyle}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        returnKeyType="done"
        onSubmitEditing={commit}
        editable={!disabled}
        onFocus={() => {
          isFocusedRef.current = true;
          // Covers the keyboard-already-open case (switching focus to this input doesn't
          // re-fire keyboardDidShow); the listener above covers the keyboard-opening-fresh
          // case. Harmless to call both — scrollIntoView() is idempotent.
          scrollIntoView?.(rowRef.current);
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          // Blurring an empty row backs out of the add — collapse to the "+" bar so we don't
          // strand an open empty input. A row with text stays open (the user is mid-entry).
          if (value.trim().length === 0) setExpanded(false);
        }}
      />
      {extras}
      <PressableScale
        style={styles.discard}
        onPress={collapse}
        hitSlop={8}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={t.a11yDiscardRow}
      >
        <Ionicons name="close" size={18} color={theme.textMuted} />
      </PressableScale>
      <PressableScale
        style={[
          styles.confirm,
          // Raised & pressable-looking ONLY when there's text to submit: real fill + button
          // shadow + a uniform light edge so it reads as lifted toward the user. While the input
          // is empty the button is inert (disabled — submitting needs text), so it drops all of
          // that and reads as a flat, recessed well (surfaceMuted + a neutral edge, no shadow) to
          // signal "type something first" instead of masquerading as a ready-to-tap control.
          active && Shadow.button,
          {
            backgroundColor: active ? fill : theme.surfaceMuted,
            borderColor: active ? 'rgba(255,255,255,0.5)' : theme.border,
          },
        ]}
        onPress={commit}
        disabled={!active}
        hitSlop={8}
        scaleTo={0.9}
        haptic={false}
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
  addBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 32,
  },
  addBarChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBarLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  input: {
    flex: 1,
    // react-native-web renders this as a plain <input>, which carries a browser-default
    // intrinsic min-width (~170px) that `flex:1` alone doesn't override — the row's other
    // children (discard/confirm, plus whatever `extras` a caller passes) would get pushed
    // outside the card whenever their combined width + that intrinsic minimum exceeded the
    // row (found 2026-07-24 wiring PlanTaskCard/HomeShoppingCard's quick-add extras — the
    // confirm button silently rendered off-card). No effect on native, where 0 is already
    // the default.
    minWidth: 0,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
  },
  discard: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
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
