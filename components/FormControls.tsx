/**
 * FormControls.tsx — shared form primitives: Checkbox, Switch, SegmentedControl, Input.
 *
 * Theme-aware wrappers so screens stop hand-rolling checkboxes/toggles with
 * ad-hoc colours. `Switch` wraps the native RN Switch with themed track/thumb
 * colours instead of the OS default green; the others are fully custom.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/PressableScale
 *   Used by → any screen wanting a themed checkbox/switch/segmented-control/input
 *   Data    → none (purely presentational, controlled components)
 *
 * Edit notes:
 *   - All interactive targets respect the 44px minimum hit area.
 *   - SegmentedControl options/labels must already be localized by the caller.
 *   - Input border is `border` normally, `borderStrong` while focused (or `bad` on error,
 *     regardless of focus); active segment background is `surface` — a raised surface,
 *     not on-colour text.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  Switch as RNSwitch,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';

// ── Checkbox ─────────────────────────────────────────────────────────────────

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const theme = useAppTheme();
  return (
    <PressableScale
      onPress={() => onChange(!checked)}
      disabled={disabled}
      scaleTo={0.97}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.checkboxRow, { opacity: disabled ? 0.5 : 1 }]}
    >
      <View
        style={[
          styles.checkboxBox,
          {
            backgroundColor: checked ? theme.accent : 'transparent',
            borderColor: checked ? theme.accent : theme.border,
          },
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={16} color={theme.accentInk} /> : null}
      </View>
      {label ? <Text style={[styles.checkboxLabel, { color: theme.text }]}>{label}</Text> : null}
    </PressableScale>
  );
}

// ── Switch ───────────────────────────────────────────────────────────────────

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function Switch({ checked, onChange, disabled }: SwitchProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.switchRow}>
      <RNSwitch
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: theme.surfaceMuted, true: theme.accentSoft }}
        thumbColor={checked ? theme.accent : theme.textInverse}
      />
    </View>
  );
}

// ── SegmentedControl ─────────────────────────────────────────────────────────

type SegmentedOption = { value: string; label: string };

type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (next: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl({ options, value, onChange, style }: SegmentedControlProps) {
  const theme = useAppTheme();
  return (
    <View style={[styles.segmentWrap, { backgroundColor: theme.surfaceMuted }, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => onChange(opt.value)}
            scaleTo={0.97}
            style={[
              styles.segment,
              active && { backgroundColor: theme.surface, shadowColor: theme.shadow },
            ]}
          >
            <Text style={[styles.segmentLabel, { color: active ? theme.text : theme.textMuted }]}>
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.bad : focused ? theme.borderStrong : theme.border;

  return (
    <View>
      {label ? <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{label}</Text> : null}
      <TextInput
        {...rest}
        placeholderTextColor={theme.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          { color: theme.text, borderColor, backgroundColor: theme.surface },
          style,
        ]}
      />
      {error ? <Text style={[styles.inputError, { color: theme.bad }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 4,
    minHeight: 44,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  switchRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    marginBottom: Spacing.xs,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
  },
  inputError: {
    fontSize: FontSize.xs,
    marginTop: 4,
  },
});
