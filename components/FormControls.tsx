/**
 * FormControls.tsx — shared form primitives: Checkbox, Switch, SegmentedControl, Input.
 *
 * Theme-aware wrappers so screens stop hand-rolling checkboxes/toggles with
 * ad-hoc colours. `Switch` wraps the native RN Switch with themed track/thumb
 * colours instead of the OS default green; the others are fully custom.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme (useAppTheme, useAccessibility), lib/haptics,
 *             components/PressableScale, react-native-reanimated
 *   Used by → any screen wanting a themed checkbox/switch/segmented-control/input
 *   Data    → none (purely presentational, controlled components)
 *
 * Edit notes:
 *   - All interactive targets respect the 44px minimum hit area.
 *   - SegmentedControl options/labels must already be localized by the caller.
 *   - Input border is `border` normally, `borderStrong` while focused (or `bad` on error,
 *     regardless of focus); active segment background is `surface` — a raised surface,
 *     not on-colour text. That raised surface is a single sliding pill (Reanimated
 *     translateX, ~150ms ease-out; snaps under reducedMotion) that moves between segments
 *     rather than a per-segment background hard-swap, and fires a `selection()` haptic on
 *     change (same motion contract as components/SlideSelector.tsx).
 */
import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  Switch as RNSwitch,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing, rgba } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
import { Duration } from '@/constants/motion';
import { selection } from '@/lib/haptics';
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
  const { reducedMotion } = useAccessibility();
  // Box fill + border crossfade as checked flips; the checkmark pops in/out on top.
  const boxStyle = useToggleColor(checked, {
    backgroundColor: [rgba(theme.accent, 0), theme.accent],
    borderColor: [theme.border, theme.accent],
  });
  return (
    <PressableScale
      onPress={() => onChange(!checked)}
      disabled={disabled}
      scaleTo={0.97}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.checkboxRow, { opacity: disabled ? 0.5 : 1 }]}
    >
      <Animated.View style={[styles.checkboxBox, boxStyle]}>
        {checked ? (
          <Animated.View
            entering={reducedMotion ? undefined : ZoomIn.duration(Duration.micro)}
            exiting={reducedMotion ? undefined : ZoomOut.duration(Duration.micro)}
          >
            <Ionicons name="checkmark" size={16} color={theme.accentInk} />
          </Animated.View>
        ) : null}
      </Animated.View>
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

const SEG_PAD = 4;

export function SegmentedControl({ options, value, onChange, style }: SegmentedControlProps) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const [track, setTrack] = useState({ w: 0, h: 0 });

  const n = options.length;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = track.w > 0 ? (track.w - SEG_PAD * 2) / n : 0;
  const pillH = Math.max(0, track.h - SEG_PAD * 2);

  const tx = useSharedValue(0);
  useEffect(() => {
    const to = activeIndex * segW;
    tx.value = reducedMotion ? to : withTiming(to, { duration: 150, easing: Easing.out(Easing.cubic) });
  }, [activeIndex, segW, reducedMotion, tx]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setTrack((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  return (
    <View style={[styles.segmentWrap, { backgroundColor: theme.surfaceMuted }, style]} onLayout={onLayout}>
      {/* Sliding raised-surface indicator — rendered first so it paints beneath the labels. */}
      {segW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentPill,
            { width: segW, height: pillH, top: SEG_PAD, left: SEG_PAD, backgroundColor: theme.surface, shadowColor: theme.shadow },
            pillStyle,
          ]}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => {
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            scaleTo={0.97}
            style={styles.segment}
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
  },
  // Sliding active indicator (raised surface). Carries the shadow the active segment used to.
  segmentPill: {
    position: 'absolute',
    borderRadius: Radius.sm - 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
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
