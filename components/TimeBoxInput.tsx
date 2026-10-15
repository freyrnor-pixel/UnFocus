/**
 * TimeBoxInput.tsx — auto-advancing HH:MM time entry for the Tasks/Oppgaver screen.
 *
 * Renders an hour box and a minute box separated by a colon over a hidden numeric
 * TextInput. Tapping a box selects it; typing two digits fills the hour and
 * auto-advances to the minute; two more fill the minute. Emits `HH:MM` (hour 00–23,
 * minute 00–59) once the minute is complete and again on blur. A `readOnly` variant renders the value as
 * a plain, non-interactive label (used for the collapsed row's start-time display).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/useKeyboardLift
 *   Used by → components/TaskCard.tsx (Start / Finish pair)
 *   Data    → none (controlled; value/onChange from props)
 *
 * Edit notes:
 *   - The hidden TextInput carries only the active box's typed buffer.
 *   - onChange fires only with a fully-formed HH:MM (minute complete, or on blur) so the
 *     parent never sees an intermediate partial like "9:" — matches the collapsed-label sync.
 *   - **Keyboard-avoidance (2026-08-01)**: `useKeyboardLift`'s own ref stands in for the
 *     `.focus()` ref this component already needed (a hidden TextInput is a host component,
 *     so no wrapping View is required — see lib/useKeyboardLift.ts's doc) — self-contained,
 *     so TaskCard doesn't need to wire anything for the Start/Finish pair.
 *   - **Each box is its own target (2026-10-15, maintainer: *"when I have inserted into the hour
 *     part, and then I try to press the minute part I can't go back to the hour part, and hour
 *     should only go from 00 to 23"*).** The active box used to be DERIVED from how many digits
 *     had been typed, so once the hour was full no tap could reach it again. Now a tap on a box
 *     selects that box and the next digits REPLACE it; backspace on an empty minute steps back
 *     to the hour. The hour refuses anything past 23 as it is typed (a leading 3–9 means
 *     03–09 and jumps on), and the minute refuses past 59 the same way — clamping after the
 *     fact turned a mistyped "27" into a silent "23". Pure rules in `typeDigit` (exported, tested).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

type Props = {
  value?: string; // 'HH:MM' or ''
  onChange: (next: string) => void;
  readOnly?: boolean;
  placeholder?: string; // shown per-box when empty, e.g. '--'
};

type Field = 'hour' | 'minute';

function partsOf(value?: string): { h: string; m: string } {
  const match = value ? /^(\d{1,2}):(\d{1,2})$/.exec(value) : null;
  return match ? { h: match[1].padStart(2, '0'), m: match[2].padStart(2, '0') } : { h: '', m: '' };
}

/**
 * One box's typing rule. `buffer` is what has been typed into the box since it was selected
 * (0–2 digits); returns the new buffer and whether the box is complete. A digit that would make
 * the box invalid (hour > 23, minute > 59) is refused rather than clamped later, and a leading
 * digit that can only start one value (hour 3–9, minute 6–9) completes the box at once.
 */
export function typeDigit(field: Field, buffer: string, digit: string): { buffer: string; done: boolean } {
  const max = field === 'hour' ? 23 : 59;
  const firstMax = field === 'hour' ? 2 : 5;
  if (buffer.length >= 2) buffer = '';
  if (buffer.length === 0) {
    const n = parseInt(digit, 10);
    if (n > firstMax) return { buffer: `0${digit}`, done: true };
    return { buffer: digit, done: false };
  }
  const next = buffer + digit;
  if (parseInt(next, 10) > max) return { buffer, done: false };
  return { buffer: next, done: true };
}

/** `HH:MM` from the two boxes, or '' while no hour is set. A set hour with no minute is `:00`. */
export function composeTime(h: string, m: string): string {
  if (!h) return '';
  return `${h.padStart(2, '0')}:${(m || '0').padStart(2, '0')}`;
}

export default function TimeBoxInput({ value, onChange, readOnly, placeholder = '--' }: Props) {
  const theme = useAppTheme();
  const { ref: inputRef, onFocus: liftOnFocus, onBlur: liftOnBlur } = useKeyboardLift<TextInput>();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState<Field>('hour');
  const [parts, setParts] = useState(() => partsOf(value));
  // What has been typed into the ACTIVE box since it was selected. Empty means "showing the
  // stored value, next digit replaces it".
  const [buffer, setBuffer] = useState('');

  // Keep local parts in sync when the parent value changes and we're not editing.
  const external = partsOf(value);
  if (!focused && (external.h !== parts.h || external.m !== parts.m)) {
    setParts(external);
  }

  if (readOnly) {
    return (
      <Text style={[styles.readOnly, { color: value ? theme.text : theme.textMuted }]}>
        {value || `${placeholder}:${placeholder}`}
      </Text>
    );
  }

  function select(field: Field) {
    setActive(field);
    setBuffer('');
    inputRef.current?.focus();
  }

  function commit(next: { h: string; m: string }) {
    setParts(next);
    if (next.h && next.m.length === 2) onChange(composeTime(next.h, next.m));
  }

  function handleChange(text: string) {
    const typed = text.replace(/\D/g, '');
    // Deletion: the hidden field only ever holds `buffer`, so a shorter value is a backspace.
    if (typed.length < buffer.length) {
      setBuffer(typed);
      return;
    }
    const digit = typed.slice(-1);
    if (!digit) return;
    const res = typeDigit(active, buffer, digit);
    const shown = res.buffer;
    const next = active === 'hour' ? { ...parts, h: shown } : { ...parts, m: shown };
    if (res.done) {
      commit(next);
      setBuffer('');
      if (active === 'hour') setActive('minute');
    } else {
      setParts(next);
      setBuffer(shown);
    }
  }

  function handleKeyPress(key: string) {
    // Backspace on an empty minute steps back to the hour — the way back the maintainer
    // couldn't find.
    if (key === 'Backspace' && buffer === '' && active === 'minute') {
      setParts((p) => ({ ...p, m: '' }));
      setActive('hour');
    }
  }

  function handleFocus() {
    setFocused(true);
    liftOnFocus();
  }

  function handleBlur() {
    setFocused(false);
    setBuffer('');
    const h = parts.h ? parts.h.padStart(2, '0') : '';
    const m = parts.m ? parts.m.padStart(2, '0') : '';
    onChange(composeTime(h, m));
    liftOnBlur();
  }

  const box = (field: Field, text: string) => {
    const on = focused && active === field;
    return (
      <Pressable
        onPress={() => select(field)}
        accessibilityRole="button"
        style={[styles.box, { borderColor: on ? theme.accent : theme.border, backgroundColor: theme.surface }]}
      >
        <Text style={[styles.boxText, { color: text ? theme.text : theme.textMuted }]}>
          {text || placeholder}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      {box('hour', parts.h)}
      <Text style={[styles.colon, { color: theme.textMuted }]}>:</Text>
      {box('minute', parts.m)}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={buffer}
        onChangeText={handleChange}
        onKeyPress={(e) => handleKeyPress(e.nativeEvent.key)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={3}
        caretHidden
      />
    </View>
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
