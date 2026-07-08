/**
 * TimeBoxInput.tsx — auto-advancing HH:MM time entry for the Tasks/Oppgaver screen.
 *
 * Renders an hour box and a minute box separated by a colon over a hidden numeric
 * TextInput. Tapping focuses the input with the hour part highlighted; typing two
 * digits fills the hour and auto-advances the highlight to the minute; two more
 * fill the minute. Emits a clamped `HH:MM` (hour 0–23, minute 0–59) once four
 * digits are entered and again on blur. A `readOnly` variant renders the value as
 * a plain, non-interactive label (used for the collapsed row's start-time display).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → components/TaskCard.tsx (Start / Finish pair)
 *   Data    → none (controlled; value/onChange from props)
 *
 * Edit notes:
 *   - The hidden TextInput carries only the raw digits (no colon), so maxLength=4 caps it.
 *   - onChange fires only with a fully-formed HH:MM (on the 4th digit or on blur) so the
 *     parent never sees an intermediate partial like "9:" — matches the collapsed-label sync.
 */
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  value?: string; // 'HH:MM' or ''
  onChange: (next: string) => void;
  readOnly?: boolean;
  placeholder?: string; // shown per-box when empty, e.g. '--'
};

function digitsOf(value?: string): string {
  return value ? value.replace(/\D/g, '').slice(0, 4) : '';
}

/** Clamp raw digits to a valid `HH:MM` (hour ≤ 23, minute ≤ 59). '' → ''. */
function normalize(digits: string): string {
  if (!digits) return '';
  const h = Math.min(23, parseInt(digits.slice(0, 2) || '0', 10) || 0);
  const m = Math.min(59, parseInt(digits.slice(2, 4) || '0', 10) || 0);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimeBoxInput({ value, onChange, readOnly, placeholder = '--' }: Props) {
  const theme = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [digits, setDigits] = useState(() => digitsOf(value));

  // Keep local digits in sync when the parent value changes and we're not editing.
  const externalDigits = digitsOf(value);
  if (!focused && externalDigits !== digits) {
    setDigits(externalDigits);
  }

  const hourStr = digits.slice(0, 2);
  const minStr = digits.slice(2, 4);
  const activeField: 'hour' | 'minute' | null = focused ? (digits.length < 2 ? 'hour' : 'minute') : null;

  if (readOnly) {
    return (
      <Text style={[styles.readOnly, { color: value ? theme.text : theme.textMuted }]}>
        {value || `${placeholder}:${placeholder}`}
      </Text>
    );
  }

  function handleChange(text: string) {
    const next = text.replace(/\D/g, '').slice(0, 4);
    setDigits(next);
    if (next.length === 4) onChange(normalize(next));
  }

  function handleBlur() {
    setFocused(false);
    onChange(normalize(digits));
  }

  const boxColor = (field: 'hour' | 'minute') => (activeField === field ? theme.accent : theme.border);

  return (
    <Pressable style={styles.wrap} onPress={() => inputRef.current?.focus()}>
      <View style={[styles.box, { borderColor: boxColor('hour'), backgroundColor: theme.surface }]}>
        <Text style={[styles.boxText, { color: hourStr ? theme.text : theme.textMuted }]}>
          {hourStr || placeholder}
        </Text>
      </View>
      <Text style={[styles.colon, { color: theme.textMuted }]}>:</Text>
      <View style={[styles.box, { borderColor: boxColor('minute'), backgroundColor: theme.surface }]}>
        <Text style={[styles.boxText, { color: minStr ? theme.text : theme.textMuted }]}>
          {minStr || placeholder}
        </Text>
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={digits}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={4}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  box: {
    minWidth: 40,
    minHeight: 38,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  boxText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  colon: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  readOnly: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
