/**
 * PadTypeRow.tsx — the pad's first line: an always-open field you can just type on.
 *
 * Replaces the collapsed "+ Add a note" bar (components/AddRow.tsx) at the BOTTOM of Home's
 * four cards with an open line at the TOP (2026-07-30, user report: "'Type note' in first row,
 * grey text that disappears when text box is selected"). The old bar cost two taps — one to
 * expand it, one to focus — and read as chrome appended after the list rather than as the next
 * line of it.
 *
 * **The prompt clears on FOCUS, not on the first keystroke.** React Native's own
 * `placeholder` only disappears once there's text; the ask is that selecting the line empties
 * it, so the prompt is rendered as our own muted Text layer that unmounts on focus. Keep it
 * that way — swapping back to a plain `placeholder` prop silently loses the behaviour.
 *
 * Connections:
 *   Imports → components/PressableScale (not used for the field itself — see edit notes),
 *             components/ScreenScaffold (ScrollIntoViewContext), constants/theme
 *             (PAD_ROW_MIN_HEIGHT, FontSize, Fonts, Radius, Shadow, Spacing, contrastOn),
 *             lib/haptics (confirm), lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/(tabs)/{plans,habits,shopping}.tsx
 *   Data    → none — presentational; fires onSubmit
 *
 * Edit notes:
 *   - **Keyboard-avoidance is inherited from AddRow's hard-won fix (2026-07-13/16)**: on focus
 *     and on `keyboardDidShow` this hands the enclosing ScreenScaffold its OWN View node via
 *     ScrollIntoViewContext, which measures and lifts just this row. Without it Android's
 *     `windowSoftInputMode=resize` can leave the line behind the keyboard and its taps go dead.
 *     Don't drop this when editing.
 *   - `extras` is the same slot AddRow had, for the per-surface quick-add controls that already
 *     exist (Notes' details field + "also a task" chip + time box, Shopping's qty stepper and
 *     list-target chip). They render only while the line is focused or has text — an idle pad
 *     line is just a prompt, not a control panel.
 *   - The commit button appears on the same terms. It's inert-looking (recessed
 *     `surfaceMuted`) until there's text, then fills with the domain accent — the same
 *     affordance grammar AddRow established, kept so the two don't read as different controls
 *     on the surfaces that still use AddRow (/plans' Whenever, health-log, automations).
 *   - Commits on submit and on blur-with-text, so a typed line is never silently lost by
 *     tapping elsewhere. Blur with an empty line just restores the prompt.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { ScrollIntoViewContext } from '@/components/ScreenScaffold';
import {
  FontSize,
  Fonts,
  PAD_ROW_MIN_HEIGHT,
  Radius,
  Shadow,
  Spacing,
  contrastOn,
} from '@/constants/theme';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** The grey prompt, worded for this card: "Type note" / "Type task" / … */
  prompt: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  /** Domain accent (lib/domainColor) — tints the commit button once there's text. */
  accent: string;
  /** Per-surface quick-add controls, shown only while the line is active. */
  extras?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PadTypeRow({
  prompt,
  value,
  onChangeText,
  onSubmit,
  accent,
  extras,
  disabled,
  style,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const [focused, setFocused] = useState(false);

  const hasText = value.trim().length > 0;
  const active = hasText && !disabled;
  // An idle line is just a prompt; controls appear once you're actually writing on it.
  const showControls = focused || hasText;

  const scrollIntoView = useContext(ScrollIntoViewContext);
  const rowRef = useRef<View>(null);
  const isFocusedRef = useRef(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isFocusedRef.current) scrollIntoView?.(rowRef.current);
    });
    return () => sub.remove();
  }, [scrollIntoView]);

  function commit() {
    if (!active) return;
    onSubmit();
    hapticConfirm();
  }

  return (
    <View
      ref={rowRef}
      style={[styles.row, disabled && styles.gated, style]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <View style={styles.field}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="done"
          onSubmitEditing={commit}
          editable={!disabled}
          accessibilityLabel={prompt}
          onFocus={() => {
            setFocused(true);
            isFocusedRef.current = true;
            // Covers the keyboard-already-open case; the listener above covers it opening
            // fresh. Both are idempotent.
            scrollIntoView?.(rowRef.current);
          }}
          onBlur={() => {
            setFocused(false);
            isFocusedRef.current = false;
            // Don't lose a typed line to a stray tap elsewhere.
            if (hasText) commit();
          }}
        />
        {/* Our own prompt layer rather than TextInput's `placeholder`, so it clears the
            moment the line is selected instead of on the first keystroke. */}
        {!focused && !hasText ? (
          <View style={styles.prompt} pointerEvents="none">
            <Text style={[styles.promptText, { color: theme.textMuted }]} numberOfLines={1}>
              {prompt}
            </Text>
          </View>
        ) : null}
      </View>

      {showControls ? extras : null}

      {showControls ? (
        <PressableScale
          style={[
            styles.confirm,
            active && Shadow.button,
            {
              backgroundColor: active ? accent : theme.surfaceMuted,
              borderColor: active ? 'rgba(255,255,255,0.5)' : theme.border,
            },
          ]}
          onPress={commit}
          disabled={!active}
          hitSlop={8}
          scaleTo={0.9}
          haptic={false}
          accessibilityRole="button"
          accessibilityLabel={t.a11yAdd}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color={active ? contrastOn(accent) : theme.textMuted}
          />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: PAD_ROW_MIN_HEIGHT,
  },
  // The prompt is absolutely positioned over the field, so showing/hiding it can't reflow
  // the row (which would make selecting the line twitch).
  field: { flex: 1, minWidth: 0, justifyContent: 'center' },
  input: {
    // See AddRow's note: react-native-web gives a bare <input> an intrinsic min-width that
    // flex:1 alone doesn't beat, which pushes the trailing controls off the card.
    minWidth: 0,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
  },
  prompt: { position: 'absolute', left: 0, right: 0 },
  promptText: { fontSize: FontSize.md, fontFamily: Fonts.regular },
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
